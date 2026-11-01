import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adToBs, bsWeekLabel } from "@/lib/bsDate";
import { recalcPoTotals, recalcOrderStatus } from "@/lib/poTotals";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      items: true,
      payments: { orderBy: { paymentDate: "asc" }, include: { advices: { orderBy: { uploadedAt: "asc" } } } },
      shipments: {
        orderBy: { shippingDate: "asc" },
        include: {
          items: { include: { receivingEvents: { orderBy: { receivedDate: "asc" } } } },
          attachments: { orderBy: { uploadedAt: "asc" } },
        },
      },
      attachments: { orderBy: { uploadedAt: "desc" } },
      stageEvents: { orderBy: { actualDate: "asc" } },
      poNotes: { orderBy: { createdAt: "desc" } },
      dateRevisions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(po);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const orderDateAD = body.orderDateAD ? new Date(body.orderDateAD) : undefined;

  // Validate actual date chain: each stage cannot precede its upstream date.
  // Read current PO to fill in dates not present in this request.
  const current = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (current) {
    const resolve = (bodyKey: string, currentVal: Date | null) =>
      body[bodyKey] ? new Date(body[bodyKey]) : currentVal;
    const orderD    = orderDateAD ?? current.orderDateAD;
    const goodsD    = resolve("actualGoodCompletionDate",  current.actualGoodCompletionDate);
    const shipD     = resolve("actualFactoryShipmentDate", current.actualFactoryShipmentDate);
    const customArrD = resolve("actualCustomArrivalDate",  current.actualCustomArrivalDate ?? null);
    const customD   = resolve("actualCustomDate",          current.actualCustomDate);
    const arrivalD  = resolve("actualArrivalDateAD",       current.actualArrivalDateAD);
    const checks: [Date | null, Date | null, string][] = [
      [orderD,    goodsD,     "Goods completion cannot be before order date"],
      [goodsD,    shipD,      "Factory shipment cannot be before goods completion"],
      [shipD,     customArrD, "Custom arrival cannot be before factory shipment"],
      [customArrD,customD,    "Custom clearance cannot be before custom arrival"],
      [customD,   arrivalD,   "Nepal arrival cannot be before custom clearance"],
    ];
    for (const [from, to, msg] of checks) {
      if (from && to && to < from) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
  }

  // Hold/cancelled are independent flags layered on top of the pipeline
  // stage (see poStages.ts); clearing either resumes at the same stage
  // instead of losing the PO's position.
  const onHold = typeof body.onHold === "boolean" ? body.onHold : undefined;
  const cancelled = typeof body.cancelled === "boolean" ? body.cancelled : undefined;

  let po = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      poNumber: body.poNumber,
      piNumber: body.piNumber !== undefined ? body.piNumber || null : undefined,
      vendorId: body.vendorId,
      agentId: body.agentId !== undefined ? body.agentId || null : undefined,
      orderDateAD,
      orderDateBS: orderDateAD ? adToBs(orderDateAD) : undefined,
      onHold,
      cancelled,
      transportMode: body.transportMode,
      gender: body.gender !== undefined ? body.gender || null : undefined,
      unitsOrdered: body.unitsOrdered !== undefined ? parseInt(body.unitsOrdered) : undefined,
      unitsShipped: body.unitsShipped !== undefined ? parseInt(body.unitsShipped) : undefined,
      unitsReceived: body.unitsReceived !== undefined ? parseInt(body.unitsReceived) : undefined,
      piAmountRMB: body.piAmountRMB !== undefined ? parseFloat(body.piAmountRMB) : undefined,
      piAmountNPR: body.piAmountNPR !== undefined ? parseFloat(body.piAmountNPR) : undefined,
      printingCostRMB: body.printingCostRMB !== undefined ? parseFloat(body.printingCostRMB) : undefined,
      chinaFreightCostRMB: body.chinaFreightCostRMB !== undefined ? parseFloat(body.chinaFreightCostRMB) : undefined,
      inspectionCostRMB: body.inspectionCostRMB !== undefined ? parseFloat(body.inspectionCostRMB) : undefined,
      estAdvanceRMB: body.estAdvanceRMB !== undefined ? parseFloat(body.estAdvanceRMB) : undefined,
      estAdvanceNPR: body.estAdvanceNPR !== undefined ? parseFloat(body.estAdvanceNPR) : undefined,
      estAdvanceDate:
        body.estAdvanceDate !== undefined
          ? body.estAdvanceDate
            ? new Date(body.estAdvanceDate)
            : null
          : undefined,
      estAdvanceDateManual: body.estAdvanceDate !== undefined ? !!body.estAdvanceDate : undefined,
      paidAdvanceRMB: body.paidAdvanceRMB !== undefined ? parseFloat(body.paidAdvanceRMB) : undefined,
      paidAdvanceNPR: body.paidAdvanceNPR !== undefined ? parseFloat(body.paidAdvanceNPR) : undefined,
      advancePaymentStatus: body.advancePaymentStatus || undefined,
      estBalanceRMB: body.estBalanceRMB !== undefined ? parseFloat(body.estBalanceRMB) : undefined,
      estBalanceNPR: body.estBalanceNPR !== undefined ? parseFloat(body.estBalanceNPR) : undefined,
      estBalanceDate:
        body.estBalanceDate !== undefined
          ? body.estBalanceDate
            ? new Date(body.estBalanceDate)
            : null
          : undefined,
      estBalanceDateManual: body.estBalanceDate !== undefined ? !!body.estBalanceDate : undefined,
      paidBalanceRMB: body.paidBalanceRMB !== undefined ? parseFloat(body.paidBalanceRMB) : undefined,
      paidBalanceNPR: body.paidBalanceNPR !== undefined ? parseFloat(body.paidBalanceNPR) : undefined,
      balancePaymentStatus: body.balancePaymentStatus || undefined,
      estCustomAmountNPR:
        body.estCustomAmountNPR !== undefined ? parseFloat(body.estCustomAmountNPR) : undefined,
      actualCustomAmountNPR:
        body.actualCustomAmountNPR !== undefined
          ? parseFloat(body.actualCustomAmountNPR)
          : undefined,
      estGoodCompletionDate: body.estGoodCompletionDate
        ? new Date(body.estGoodCompletionDate)
        : undefined,
      revisedGoodCompletionDate: body.revisedGoodCompletionDate
        ? new Date(body.revisedGoodCompletionDate)
        : undefined,
      actualGoodCompletionDate: body.actualGoodCompletionDate
        ? new Date(body.actualGoodCompletionDate)
        : undefined,
      estFactoryShipmentDate: body.estFactoryShipmentDate
        ? new Date(body.estFactoryShipmentDate)
        : undefined,
      actualFactoryShipmentDate: body.actualFactoryShipmentDate
        ? new Date(body.actualFactoryShipmentDate)
        : undefined,
      shipmentShifted: body.shipmentShifted,
      estCustomArrivalDate: body.estCustomArrivalDate
        ? new Date(body.estCustomArrivalDate)
        : undefined,
      actualCustomDate: body.actualCustomDate ? new Date(body.actualCustomDate) : undefined,
      estCustomClearanceDate: body.estCustomClearanceDate
        ? new Date(body.estCustomClearanceDate)
        : undefined,
      estArrivalDateAD: body.estArrivalDateAD ? new Date(body.estArrivalDateAD) : undefined,
      estArrivalDateBS: body.estArrivalDateAD
        ? adToBs(new Date(body.estArrivalDateAD))
        : undefined,
      actualArrivalDateAD: body.actualArrivalDateAD
        ? new Date(body.actualArrivalDateAD)
        : undefined,
      estArrivalWeek: body.estArrivalWeek !== undefined ? body.estArrivalWeek || null
        : body.estArrivalDateAD ? bsWeekLabel(new Date(body.estArrivalDateAD)) : undefined,
      actualArrivalWeek: body.actualArrivalWeek !== undefined ? body.actualArrivalWeek || null
        : body.actualArrivalDateAD ? bsWeekLabel(new Date(body.actualArrivalDateAD)) : undefined,
      discrepancyDays: body.discrepancyDays !== undefined ? parseInt(body.discrepancyDays) : undefined,
      remarks: body.remarks,
      sourceLink: body.sourceLink,
    },
  });

  // Keep PO-level StageEvents in sync with the actual date fields so the
  // history timeline always reflects what's saved in the process section.
  // (No DB unique constraint on nullable shipmentId, so we do findFirst+update/create.)
  async function syncStageEvent(stage: string, date: Date) {
    const existing = await prisma.stageEvent.findFirst({ where: { poId: id, stage, shipmentId: null } });
    if (existing) {
      await prisma.stageEvent.update({ where: { id: existing.id }, data: { actualDate: date } });
    } else {
      await prisma.stageEvent.create({ data: { poId: id, stage, actualDate: date } });
    }
  }
  // Log a revision record when estGoodCompletionDate is manually changed with a reason
  if (body.estGoodCompletionDate && body.estGoodCompletionDateReason && current) {
    await prisma.pODateRevision.create({
      data: {
        poId: id,
        field: "estGoodCompletionDate",
        label: "Est. Good Completion",
        fromDate: current.estGoodCompletionDate,
        toDate: new Date(body.estGoodCompletionDate),
        reason: body.estGoodCompletionDateReason,
      },
    });
  }

  if (body.actualGoodCompletionDate) await syncStageEvent("GOODS_COMPLETED", new Date(body.actualGoodCompletionDate));
  if (body.actualFactoryShipmentDate) await syncStageEvent("SHIPPED", new Date(body.actualFactoryShipmentDate));
  if (body.actualCustomDate) await syncStageEvent("CUSTOM", new Date(body.actualCustomDate));
  if (body.actualArrivalDateAD) await syncStageEvent("RECEIVED", new Date(body.actualArrivalDateAD));

  const affectsEstimates = [
    "orderDateAD",
    "vendorId",
    "printingCostRMB",
    "chinaFreightCostRMB",
    "inspectionCostRMB",
    "estAdvanceDate",
    "estBalanceDate",
    "estGoodCompletionDate",
    "revisedGoodCompletionDate",
    "actualGoodCompletionDate",
    "estFactoryShipmentDate",
    "actualFactoryShipmentDate",
    "transportMode",
  ].some((k) => body[k] !== undefined);
  if (affectsEstimates) {
    await recalcPoTotals(id);
    po = (await prisma.purchaseOrder.findUnique({ where: { id } })) ?? po;
  } else if (onHold === false || cancelled === false) {
    // Coming off hold/cancelled: re-derive the automatic stages in case
    // shipment/receiving data moved on while the PO was paused.
    await recalcOrderStatus(id);
    po = (await prisma.purchaseOrder.findUnique({ where: { id } })) ?? po;
  }
  return NextResponse.json(po);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
