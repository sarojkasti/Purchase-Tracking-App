import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adToBs } from "@/lib/bsDate";

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
      payments: { orderBy: { paymentDate: "asc" } },
      shipments: { orderBy: { shippingDate: "asc" } },
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

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      poNumber: body.poNumber,
      piNumber: body.piNumber || null,
      vendorId: body.vendorId,
      orderDateAD,
      orderDateBS: orderDateAD ? adToBs(orderDateAD) : undefined,
      status: body.status,
      transportMode: body.transportMode,
      brand: body.brand || null,
      gender: body.gender || null,
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
      estAdvanceDate: body.estAdvanceDate ? new Date(body.estAdvanceDate) : undefined,
      paidAdvanceRMB: body.paidAdvanceRMB !== undefined ? parseFloat(body.paidAdvanceRMB) : undefined,
      paidAdvanceNPR: body.paidAdvanceNPR !== undefined ? parseFloat(body.paidAdvanceNPR) : undefined,
      advancePaymentStatus: body.advancePaymentStatus || undefined,
      estBalanceRMB: body.estBalanceRMB !== undefined ? parseFloat(body.estBalanceRMB) : undefined,
      estBalanceNPR: body.estBalanceNPR !== undefined ? parseFloat(body.estBalanceNPR) : undefined,
      estBalanceDate: body.estBalanceDate ? new Date(body.estBalanceDate) : undefined,
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
      actualArrivalWeek: body.actualArrivalWeek || undefined,
      discrepancyDays: body.discrepancyDays !== undefined ? parseInt(body.discrepancyDays) : undefined,
      remarks: body.remarks,
      sourceLink: body.sourceLink,
    },
  });
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
