import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, shipmentBreakdownLabel, type Stage } from "@/lib/poStages";
import { bsMonthName, bsWeekLabel } from "@/lib/bsDate";
import { getApplicableForexRate } from "@/lib/forexRate";

const CUSTOM_DUTY_TABLE: Record<number, [number, number]> = {
  2: [160, 190], 3: [210, 240], 4: [265, 295], 5: [320, 350],
  6: [375, 405], 7: [425, 460], 8: [480, 515], 9: [535, 565], 10: [590, 620],
};
const CUSTOM_DUTY_ITEM_TYPES = ["Sunglasses", "Frames"];
const NPR_PER_USD = 155;

function calcEstCustomNPR(amountRMB: number | null, unitsOrdered: number, forexRate: number | null, transportMode: string): number {
  if (!amountRMB || !forexRate || unitsOrdered <= 0) return 0;
  const perUnitNPR = (amountRMB / unitsOrdered) * forexRate;
  const perUnitUSD = perUnitNPR / NPR_PER_USD;
  const bracket = Math.min(10, Math.max(2, Math.ceil(perUnitUSD)));
  const rates = CUSTOM_DUTY_TABLE[bracket];
  if (!rates) return 0;
  return rates[transportMode === "AIRWAY" ? 1 : 0] * unitsOrdered;
}

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
      items: { select: { brand: true, amountRMB: true, amountNPR: true, gender: true, itemType: true, unitsOrdered: true } },
      shipments: { select: { id: true, shippingDate: true, status: true, shippedQty: true, arrivalDate: true, transportMode: true, customPoint: true, items: { select: { actualCustomRateNPR: true, receivedQty: true, receivingEvents: { select: { receivedDate: true } } } } }, orderBy: { shippingDate: "asc" } },
      attachments: { where: { type: "PI" }, select: { url: true, fileName: true }, orderBy: { uploadedAt: "asc" }, take: 1 },
    },
    orderBy: { orderDateAD: "desc" },
  });

  const latestForexRate = await getApplicableForexRate(null, new Date());

  const forexCache = new Map<string, number | null>();
  async function getForex(agentId: string | null, date: Date) {
    const key = `${agentId}|${date.toISOString()}`;
    if (!forexCache.has(key)) forexCache.set(key, await getApplicableForexRate(agentId, date));
    return forexCache.get(key)!;
  }

  const rows = await Promise.all(pos.map(async (po) => {
    const forexRate = await getForex(po.agentId ?? po.vendor.agentId, po.orderDateAD);
    const brands = Array.from(new Set(po.items.map((i) => i.brand).filter(Boolean)));
    const genders = Array.from(new Set(po.items.map((i) => i.gender).filter(Boolean)));
    const liveAmountRMB = po.items.reduce((s, i) => s + (i.amountRMB ?? 0), 0);
    const liveAmountNPR = po.items.reduce((s, i) => s + (i.amountNPR ?? 0), 0);

    // Auto-split: any advance paid beyond estAdvanceRMB is reclassified as balance paid
    const advanceOverpaidRMB = Math.max(po.paidAdvanceRMB - po.estAdvanceRMB, 0);
    const effectivePaidAdvanceRMB = po.paidAdvanceRMB - advanceOverpaidRMB;
    const effectivePaidBalanceRMB = po.paidBalanceRMB + advanceOverpaidRMB;
    // NPR: carry over proportionally if paidAdvanceRMB > 0, else use forex
    const advanceNPRRatio = po.paidAdvanceRMB > 0 ? po.paidAdvanceNPR / po.paidAdvanceRMB : (latestForexRate ?? 0);
    const advanceOverpaidNPR = advanceOverpaidRMB * advanceNPRRatio;
    const effectivePaidAdvanceNPR = po.paidAdvanceNPR - advanceOverpaidNPR;
    const effectivePaidBalanceNPR = po.paidBalanceNPR + advanceOverpaidNPR;

    return {
    id: po.id,
    poNumber: po.poNumber,
    piNumber: po.piNumber,
    piAttachmentUrl: po.attachments[0]?.url ?? null,
    vendor: po.vendor.name,
    agent: po.vendor.agent?.name ?? null,

    orderDateAD: po.orderDateAD,
    orderDateBS: po.orderDateBS,
    orderMonth: bsMonthName(po.orderDateAD),

    status: statusLabel(po),
    transportMode: po.transportMode,
    brand: brands.join(", ") || null,
    gender: genders.join(", ") || null,

    unitsOrdered: po.unitsOrdered,
    unitsShipped: po.unitsShipped,
    unitsReceived: po.unitsReceived,

    piAmountRMB: liveAmountRMB,
    piAmountNPR: liveAmountNPR,

    estAdvanceRMB: po.estAdvanceRMB,
    estAdvanceNPR: po.estAdvanceNPR,
    estAdvanceDate: po.estAdvanceDate,
    paidAdvanceRMB: effectivePaidAdvanceRMB,
    paidAdvanceNPR: effectivePaidAdvanceNPR,
    remainingAdvanceRMB: Math.max(po.estAdvanceRMB - effectivePaidAdvanceRMB, 0),
    remainingAdvanceNPR: latestForexRate ? Math.max(po.estAdvanceRMB - effectivePaidAdvanceRMB, 0) * latestForexRate : null,
    advancePaymentStatus: po.advancePaymentStatus,

    estBalanceRMB: po.estBalanceRMB,
    estBalanceNPR: po.estBalanceNPR,
    estBalanceDate: po.estBalanceDate,
    paidBalanceRMB: effectivePaidBalanceRMB,
    paidBalanceNPR: effectivePaidBalanceNPR,
    remainingBalanceRMB: Math.max(po.estBalanceRMB - effectivePaidBalanceRMB, 0),
    remainingBalanceNPR: latestForexRate ? Math.max(po.estBalanceRMB - effectivePaidBalanceRMB, 0) * latestForexRate : null,
    balancePaymentStatus: po.balancePaymentStatus,

    estCustomAmountNPR: po.items
      .filter((i) => i.itemType && CUSTOM_DUTY_ITEM_TYPES.includes(i.itemType))
      .reduce((s, i) => s + calcEstCustomNPR(i.amountRMB, i.unitsOrdered, forexRate, po.transportMode), 0) || null,
    actualCustomAmountNPR: po.shipments.flatMap((sh) => sh.items)
      .reduce((s, li) => s + (li.actualCustomRateNPR != null ? li.actualCustomRateNPR * li.receivedQty : 0), 0) || null,

    printingCostRMB: po.printingCostRMB,
    chinaFreightCostRMB: po.chinaFreightCostRMB,
    inspectionCostRMB: po.inspectionCostRMB,
    totalPOAmountRMB: liveAmountRMB + po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB,

    estGoodCompletionDate: po.estGoodCompletionDate,
    actualGoodCompletionDate: po.actualGoodCompletionDate,

    estFactoryShipmentDate: po.estFactoryShipmentDate,
    actualFactoryShipmentDate: po.actualFactoryShipmentDate,
    shipmentShifted: po.shipmentShifted,

    estCustomArrivalDate: po.estCustomArrivalDate,
    actualCustomDate: po.actualCustomDate,
    estCustomClearanceDate: po.estCustomClearanceDate,

    estArrivalDateAD: po.estArrivalDateAD,
    estArrivalDateBS: po.estArrivalDateBS,
    estArrivalWeek: po.estArrivalWeek || bsWeekLabel(po.estArrivalDateAD),
    actualArrivalDateAD: (() => {
      if (po.actualArrivalDateAD) return po.actualArrivalDateAD;
      const allDates: Date[] = po.shipments.flatMap(s => [
        s.arrivalDate,
        ...s.items.flatMap(i => i.receivingEvents.map(e => e.receivedDate)),
      ]).filter((d): d is Date => d != null);
      return allDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    })(),
    actualArrivalWeek: (() => {
      if (po.actualArrivalWeek) return po.actualArrivalWeek;
      const allDates: Date[] = po.shipments.flatMap(s => [
        s.arrivalDate,
        ...s.items.flatMap(i => i.receivingEvents.map(e => e.receivedDate)),
      ]).filter((d): d is Date => d != null);
      const latest = allDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      return bsWeekLabel(po.actualArrivalDateAD ?? latest);
    })(),

    discrepancyDays: po.discrepancyDays,
    remarks: po.remarks,
    sourceLink: po.sourceLink,
    shipments: po.shipments.map(s => ({
      id: s.id,
      shippingDate: s.shippingDate,
      arrivalDate: s.arrivalDate,
      shippedQty: s.shippedQty,
      receivedQty: s.items.reduce((sum, i) => sum + i.receivedQty, 0),
      status: s.status,
      transportMode: s.transportMode,
      customPoint: s.customPoint,
    })),
    };
  }));

  return NextResponse.json(rows);
}
