import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicableForexRate } from "@/lib/forexRate";
import { getApplicableFreightRates } from "@/lib/vendorPolicy";

export async function GET() {
  const items = await prisma.pOItem.findMany({
    include: {
      po: {
        include: {
          vendor: { include: { agent: true } },
          items: { select: { unitsOrdered: true } },
        },
      },
    },
    orderBy: [{ po: { orderDateAD: "desc" } }, { createdAt: "asc" }],
  });

  const multipliers = await prisma.mrpMultiplier.findMany();
  const multiplierByBrand = new Map(multipliers.map((m) => [m.brand, m.multiplier]));

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
      const extraCostsRMB = po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB;
      const shareOfExtra = poUnitsTotal > 0 ? item.unitsOrdered / poUnitsTotal : 0;
      const apportionedExtraRMB = shareOfExtra * extraCostsRMB;

      const landedRMB = (item.materialCost ?? 0) + apportionedExtraRMB;
      const forexRate = await getForexRate(po.vendor.agentId, po.orderDateAD);
      const landedNPR = forexRate ? landedRMB * forexRate : null;

      const freightRates = await getFreightRates(po.vendorId, po.orderDateAD);
      const freightPolicy = freightRates.find(
        (r) => r.itemCategory === item.itemType && r.transportMode === (po.transportMode === "AIRWAY" ? "Airway" : "Road")
      );
      const agentFreightNPR = freightPolicy ? freightPolicy.rate * item.unitsOrdered : 0;

      const multiplier = item.brand ? multiplierByBrand.get(item.brand) ?? null : null;
      const estMrp =
        landedNPR !== null && multiplier !== null
          ? (landedNPR + agentFreightNPR) * multiplier
          : null;

      return {
        poNumber: po.poNumber,
        piNumber: po.piNumber,
        vendor: po.vendor.name,
        agent: po.vendor.agent?.name ?? null,
        orderDateAD: po.orderDateAD,
        orderDateBS: po.orderDateBS,
        status: po.status,
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
        priceRangeLabel: item.priceRangeLabel,

        unitsOrdered: item.unitsOrdered,
        shippedQty: item.shippedQty,
        receivedQty: item.receivedQty,

        materialCost: item.materialCost,
        printingCost: item.printingCost,
        freightCost: item.freightCost,
        amountRMB: item.amountRMB,
        convRate: item.convRate,
        amountNPR: item.amountNPR,
        estCustomNPR: item.estCustomNPR,

        estArrivalDate: item.estArrivalDate,
        goodsStatus: item.goodsStatus,
      };
    })
  );

  return NextResponse.json(rows);
}
