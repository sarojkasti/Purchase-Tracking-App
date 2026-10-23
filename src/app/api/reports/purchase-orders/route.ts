import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, shipmentBreakdownLabel, type Stage } from "@/lib/poStages";

function statusLabel(po: { stage: string; onHold: boolean; cancelled: boolean; unitsOrdered: number; shipments: { status: string; shippedQty: number }[] }) {
  if (po.cancelled) return "Cancelled";
  if (po.onHold) return "On Hold";
  const stage = po.stage as Stage;
  const label = STAGE_LABELS[stage] ?? po.stage;
  if (!["SHIPPED", "CUSTOM", "RECEIVED"].includes(stage)) return label;
  return shipmentBreakdownLabel(po.shipments, label, po.unitsOrdered);
}

export async function GET() {
  const pos = await prisma.purchaseOrder.findMany({
    include: {
      vendor: { include: { agent: true } },
      items: { select: { brand: true } },
      shipments: { select: { status: true, shippedQty: true } },
    },
    orderBy: { orderDateAD: "desc" },
  });

  const rows = pos.map((po) => {
    const brands = Array.from(new Set(po.items.map((i) => i.brand).filter(Boolean)));
    return {
    poNumber: po.poNumber,
    piNumber: po.piNumber,
    vendor: po.vendor.name,
    agent: po.vendor.agent?.name ?? null,

    orderDateAD: po.orderDateAD,
    orderDateBS: po.orderDateBS,
    orderMonth: po.orderMonth,

    status: statusLabel(po),
    transportMode: po.transportMode,
    brand: brands.join(", ") || null,
    gender: po.gender,

    unitsOrdered: po.unitsOrdered,
    unitsShipped: po.unitsShipped,
    unitsReceived: po.unitsReceived,

    piAmountRMB: po.piAmountRMB,
    piAmountNPR: po.piAmountNPR,

    estAdvanceRMB: po.estAdvanceRMB,
    estAdvanceNPR: po.estAdvanceNPR,
    estAdvanceDate: po.estAdvanceDate,
    paidAdvanceRMB: po.paidAdvanceRMB,
    paidAdvanceNPR: po.paidAdvanceNPR,
    advancePaymentStatus: po.advancePaymentStatus,

    estBalanceRMB: po.estBalanceRMB,
    estBalanceNPR: po.estBalanceNPR,
    estBalanceDate: po.estBalanceDate,
    paidBalanceRMB: po.paidBalanceRMB,
    paidBalanceNPR: po.paidBalanceNPR,
    balancePaymentStatus: po.balancePaymentStatus,

    estCustomAmountNPR: po.estCustomAmountNPR,
    actualCustomAmountNPR: po.actualCustomAmountNPR,

    printingCostRMB: po.printingCostRMB,
    chinaFreightCostRMB: po.chinaFreightCostRMB,
    inspectionCostRMB: po.inspectionCostRMB,
    totalPOAmountRMB: po.piAmountRMB + po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB,

    estGoodCompletionDate: po.estGoodCompletionDate,
    revisedGoodCompletionDate: po.revisedGoodCompletionDate,
    actualGoodCompletionDate: po.actualGoodCompletionDate,

    estFactoryShipmentDate: po.estFactoryShipmentDate,
    actualFactoryShipmentDate: po.actualFactoryShipmentDate,
    shipmentShifted: po.shipmentShifted,

    estCustomArrivalDate: po.estCustomArrivalDate,
    actualCustomDate: po.actualCustomDate,
    estCustomClearanceDate: po.estCustomClearanceDate,

    estArrivalDateAD: po.estArrivalDateAD,
    estArrivalDateBS: po.estArrivalDateBS,
    estArrivalWeek: po.estArrivalWeek,
    actualArrivalDateAD: po.actualArrivalDateAD,
    actualArrivalWeek: po.actualArrivalWeek,

    discrepancyDays: po.discrepancyDays,
    remarks: po.remarks,
    sourceLink: po.sourceLink,
    };
  });

  return NextResponse.json(rows);
}
