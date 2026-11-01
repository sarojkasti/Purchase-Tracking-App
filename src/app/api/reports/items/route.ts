import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicableForexRate } from "@/lib/forexRate";
import { getApplicableFreightRates } from "@/lib/vendorPolicy";
import { STAGE_LABELS, shipmentBreakdownLabel, type Stage } from "@/lib/poStages";
import { bsMonthName } from "@/lib/bsDate";

function parseBand(label: string): [number, number | null] {
  const rangeMatch = label.match(/^(\d+)[^\d]+(\d+)/);
  if (rangeMatch) return [parseInt(rangeMatch[1]), parseInt(rangeMatch[2])];
  const minMatch = label.match(/^(\d+)/);
  return minMatch ? [parseInt(minMatch[1]), null] : [0, null];
}

function calcPriceRange(
  estMrp: number | null,
  itemType: string | null,
  brand: string | null,
  bands: { label: string; sortOrder: number }[]
): string | null {
  if (estMrp === null || !itemType || !brand || bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => parseBand(a.label)[0] - parseBand(b.label)[0]);
  for (const band of sorted) {
    const [min, max] = parseBand(band.label);
    if (estMrp >= min && (max === null || estMrp <= max)) return band.label;
  }
  return null;
}

// Custom duty lookup table (Rajin agent, per piece in NPR)
// Key: USD bracket (ceiling), Value: [Roadways, Airways]
const CUSTOM_DUTY_TABLE: Record<number, [number, number]> = {
  2:  [160, 190],
  3:  [210, 240],
  4:  [265, 295],
  5:  [320, 350],
  6:  [375, 405],
  7:  [425, 460],
  8:  [480, 515],
  9:  [535, 565],
  10: [590, 620],
};
const CUSTOM_DUTY_ITEM_TYPES = ["Sunglasses", "Frames"];
const NPR_PER_USD = 155;

function calcEstCustomNPR(
  amountRMB: number | null,
  unitsOrdered: number,
  forexRate: number | null,
  transportMode: string
): number | null {
  if (!amountRMB || !forexRate || unitsOrdered <= 0) return null;
  const perUnitNPR = (amountRMB / unitsOrdered) * forexRate;
  const perUnitUSD = perUnitNPR / NPR_PER_USD;
  const bracket = Math.min(10, Math.max(2, Math.ceil(perUnitUSD)));
  const rates = CUSTOM_DUTY_TABLE[bracket];
  if (!rates) return null;
  const isAirway = transportMode === "AIRWAY";
  return rates[isAirway ? 1 : 0] * unitsOrdered;
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
  const items = await prisma.pOItem.findMany({
    include: {
      po: {
        include: {
          vendor: { include: { agent: true } },
          agent: true,
          items: { select: { unitsOrdered: true } },
          shipments: { select: { status: true, shippedQty: true } },
        },
      },
    },
    orderBy: [{ po: { orderDateAD: "desc" } }, { createdAt: "asc" }],
  });

  const multipliers = await prisma.mrpMultiplier.findMany();
  const multiplierByBrand = new Map(multipliers.map((m) => [m.brand, m.multiplier]));

  const mrpRanges = await prisma.mrpRange.findMany({ orderBy: { sortOrder: "asc" } });
  const mrpRangesByKey = new Map<string, { label: string; sortOrder: number }[]>();
  for (const r of mrpRanges) {
    const key = `${r.brand.trim().toLowerCase()}|${r.itemType.trim().toLowerCase()}`;
    if (!mrpRangesByKey.has(key)) mrpRangesByKey.set(key, []);
    mrpRangesByKey.get(key)!.push({ label: r.label, sortOrder: r.sortOrder });
  }

  // Cache forex rate and freight rates per PO, since sibling items share them.
  const forexCache = new Map<string, number | null>();
  const freightCache = new Map<string, Awaited<ReturnType<typeof getApplicableFreightRates>>>();

  async function getForexRate(agentId: string | null, orderDateAD: Date) {
    const key = `${agentId}|${orderDateAD.toISOString()}`;
    if (!forexCache.has(key)) {
      forexCache.set(key, await getApplicableForexRate(agentId, orderDateAD));
    }
    return forexCache.get(key)!;
  }

  async function getFreightRates(vendorId: string, orderDateAD: Date) {
    const key = `${vendorId}|${orderDateAD.toISOString()}`;
    if (!freightCache.has(key)) {
      freightCache.set(key, await getApplicableFreightRates(vendorId, orderDateAD));
    }
    return freightCache.get(key)!;
  }

  const rows = await Promise.all(
    items.map(async (item) => {
      const po = item.po;
      const poUnitsTotal = po.items.reduce((s, i) => s + i.unitsOrdered, 0);
      const shareOfExtra = poUnitsTotal > 0 ? item.unitsOrdered / poUnitsTotal : 0;
      const apportionedPrintingRMB = shareOfExtra * po.printingCostRMB;
      const apportionedFreightRMB = shareOfExtra * po.chinaFreightCostRMB;
      const apportionedInspectionRMB = shareOfExtra * po.inspectionCostRMB;
      const apportionedExtraRMB = apportionedPrintingRMB + apportionedFreightRMB + apportionedInspectionRMB;

      const effectiveAgentId = po.agentId ?? po.vendor.agentId;
      const forexRate = await getForexRate(effectiveAgentId, po.orderDateAD);

      const landedNPR = item.amountRMB != null && forexRate
        ? (item.amountRMB + apportionedExtraRMB) * forexRate
        : null;

      const freightRates = await getFreightRates(po.vendorId, po.orderDateAD);
      const freightPolicy = freightRates.find(
        (r) => r.itemCategory === item.itemType && r.transportMode === (po.transportMode === "AIRWAY" ? "Airway" : "Road")
      );
      const agentFreightNPR = freightPolicy ? freightPolicy.rate * item.unitsOrdered : 0;

      const multiplier = item.brand ? multiplierByBrand.get(item.brand) ?? null : null;
      const estMrp =
        landedNPR !== null && multiplier !== null && item.unitsOrdered > 0
          ? (landedNPR / item.unitsOrdered) * multiplier
          : null;

      return {
        poNumber: po.poNumber,
        piNumber: po.piNumber,
        vendor: po.vendor.shortName,
        agent: po.agent?.name ?? po.vendor.agent?.name ?? null,
        orderDateAD: po.orderDateAD,
        orderDateBS: po.orderDateBS,
        orderMonthBS: bsMonthName(po.orderDateAD),
        status: statusLabel(po),
        transportMode: po.transportMode,

        chineseSku: item.chineseSku,
        newmewSku: item.newmewSku,
        orderType: item.orderType,
        specificName: item.specificName,
        itemType: item.itemType,
        mfgType: item.mfgType,
        brand: item.brand,
        category: item.category,
        gender: item.gender,
        size: item.size,
        front: item.front,
        temple: item.temple,
        lens: item.lens,
        colors: item.colors.join(", "),
        imageUrl: item.imageUrl,
        mrp: item.mrp,
        estMrp,
        priceRangeLabel: (() => {
          const key = `${item.brand?.trim().toLowerCase()}|${item.itemType?.trim().toLowerCase()}`;
          const bands = mrpRangesByKey.get(key) ?? [];
          return calcPriceRange(estMrp, item.itemType, item.brand, bands);
        })(),

        unitsOrdered: item.unitsOrdered,
        shippedQty: item.shippedQty,
        receivedQty: item.receivedQty,

        materialCost: item.amountRMB != null && item.unitsOrdered > 0 ? item.amountRMB / item.unitsOrdered : null,
        printingCost: apportionedPrintingRMB || null,
        freightCost: apportionedFreightRMB || null,
        inspectionCost: apportionedInspectionRMB || null,
        amountRMB: item.amountRMB,
        landedCostRMB: item.amountRMB != null ? item.amountRMB + apportionedPrintingRMB + apportionedFreightRMB + apportionedInspectionRMB : null,
        convRate: forexRate,
        amountNPR: landedNPR,
        estCustomNPR: item.itemType && CUSTOM_DUTY_ITEM_TYPES.includes(item.itemType)
          ? calcEstCustomNPR(item.amountRMB, item.unitsOrdered, forexRate, po.transportMode)
          : null,

        estArrivalDate: po.estArrivalDateAD,
        goodsStatus: item.goodsStatus,
      };
    })
  );

  return NextResponse.json(rows);
}
