import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const pos = await prisma.purchaseOrder.findMany({
    include: { vendor: { include: { agent: true } } },
    orderBy: { orderDateAD: "desc" },
  });

  const rows = pos.map((po) => ({
    poNumber: po.poNumber,
    piNumber: po.piNumber,
    vendor: po.vendor.name,
    agent: po.vendor.agent?.name ?? null,

    orderDateAD: po.orderDateAD,
    orderDateBS: po.orderDateBS,
    orderMonth: po.orderMonth,

    status: po.status,
    transportMode: po.transportMode,
    brand: po.brand,
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
  }));

  return NextResponse.json(rows);
}
