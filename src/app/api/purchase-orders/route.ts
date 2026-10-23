import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adToBs } from "@/lib/bsDate";
import { upsertProductFromItem } from "@/lib/productUpsert";
import { recalcPoTotals } from "@/lib/poTotals";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendorId") || undefined;
  const stage = searchParams.get("stage") || undefined;

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      vendorId: vendorId || undefined,
      stage: (stage as never) || undefined,
    },
    include: { vendor: true, _count: { select: { items: true } } },
    orderBy: { orderDateAD: "desc" },
  });
  return NextResponse.json(pos);
}

type NewItemInput = {
  chineseSku?: string;
  newmewSku?: string;
  specificName?: string;
  itemType?: string;
  brand?: string;
  category?: string;
  gender?: string;
  size?: string;
  front?: string;
  temple?: string;
  lens?: string;
  colors?: string[];
  imageUrl?: string;
  mrp?: string | number;
  mfgType?: string;
  unitsOrdered?: string | number;
  shippedQty?: string | number;
  receivedQty?: string | number;
  amountRMB?: string | number;
  convRate?: string | number;
  goodsStatus?: string;
  estArrivalDate?: string;
};

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.piNumber || !String(body.piNumber).trim()) {
    return NextResponse.json({ error: "CHN PI No is required" }, { status: 400 });
  }

  const orderDateAD = new Date(body.orderDateAD);
  const orderDateBS = adToBs(orderDateAD);

  const items: NewItemInput[] = Array.isArray(body.items) ? body.items : [];
  const unitsOrderedFromItems = items.reduce(
    (s, i) => s + (parseInt(String(i.unitsOrdered)) || 0),
    0
  );
  const piAmountRMBFromItems = items.reduce(
    (s, i) => s + (i.amountRMB ? parseFloat(String(i.amountRMB)) : 0),
    0
  );

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: body.poNumber,
      piNumber: body.piNumber || null,
      vendorId: body.vendorId,
      orderDateAD,
      orderDateBS,
      transportMode: body.transportMode || "ROAD",
      gender: body.gender || null,
      unitsOrdered: unitsOrderedFromItems || parseInt(body.unitsOrdered) || 0,
      piAmountRMB: piAmountRMBFromItems || parseFloat(body.piAmountRMB) || 0,
      piAmountNPR: parseFloat(body.piAmountNPR) || 0,
      printingCostRMB: parseFloat(body.printingCostRMB) || 0,
      chinaFreightCostRMB: parseFloat(body.chinaFreightCostRMB) || 0,
      inspectionCostRMB: parseFloat(body.inspectionCostRMB) || 0,
      estAdvanceRMB: parseFloat(body.estAdvanceRMB) || 0,
      estAdvanceNPR: parseFloat(body.estAdvanceNPR) || 0,
      estAdvanceDate: body.estAdvanceDate ? new Date(body.estAdvanceDate) : null,
      estBalanceRMB: parseFloat(body.estBalanceRMB) || 0,
      estBalanceNPR: parseFloat(body.estBalanceNPR) || 0,
      estBalanceDate: body.estBalanceDate ? new Date(body.estBalanceDate) : null,
      estGoodCompletionDate: body.estGoodCompletionDate
        ? new Date(body.estGoodCompletionDate)
        : null,
      estFactoryShipmentDate: body.estFactoryShipmentDate
        ? new Date(body.estFactoryShipmentDate)
        : null,
      estArrivalDateAD: body.estArrivalDateAD ? new Date(body.estArrivalDateAD) : null,
      estArrivalDateBS: body.estArrivalDateAD ? adToBs(new Date(body.estArrivalDateAD)) : null,
      remarks: body.remarks || null,
      sourceLink: body.sourceLink || null,
      items: {
        create: items
          .filter((i) => i.chineseSku || i.specificName || i.unitsOrdered)
          .map((i) => {
            const amountRMB = i.amountRMB ? parseFloat(String(i.amountRMB)) : null;
            const convRate = i.convRate ? parseFloat(String(i.convRate)) : null;
            const front = i.front || null;
            const temple = i.temple || null;
            const lens = i.lens || null;
            return {
              chineseSku: i.chineseSku || null,
              newmewSku: i.newmewSku || null,
              specificName: i.specificName || null,
              itemType: i.itemType || null,
              mfgType: i.mfgType || null,
              brand: i.brand || null,
              category: i.category || [front, temple, lens].filter(Boolean).join("+") || null,
              gender: i.gender || null,
              size: i.size || null,
              front,
              temple,
              lens,
              colors: Array.isArray(i.colors) ? i.colors : [],
              imageUrl: i.imageUrl || null,
              mrp: i.mrp ? parseFloat(String(i.mrp)) : null,
              unitsOrdered: parseInt(String(i.unitsOrdered)) || 0,
              shippedQty: parseInt(String(i.shippedQty)) || 0,
              receivedQty: parseInt(String(i.receivedQty)) || 0,
              amountRMB,
              convRate,
              amountNPR: amountRMB && convRate ? amountRMB * convRate : null,
              goodsStatus: i.goodsStatus || null,
              estArrivalDate: i.estArrivalDate ? new Date(i.estArrivalDate) : null,
            };
          }),
      },
    },
    include: { items: true },
  });

  for (const item of po.items) {
    await upsertProductFromItem({
      chineseSku: item.chineseSku,
      newmewSku: item.newmewSku,
      specificName: item.specificName,
      itemType: item.itemType,
      brand: item.brand,
      gender: item.gender,
      size: item.size,
      front: item.front,
      temple: item.temple,
      lens: item.lens,
      mrp: item.mrp,
      imageUrl: item.imageUrl,
    });
  }

  if (po.items.length === 0) {
    return NextResponse.json(po, { status: 201 });
  }

  await recalcPoTotals(po.id);
  const updated = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include: { items: true } });
  return NextResponse.json(updated, { status: 201 });
}
