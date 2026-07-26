import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertProductFromItem } from "@/lib/productUpsert";
import { recalcPoTotals } from "@/lib/poTotals";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body = await req.json();

  const front = body.front || null;
  const temple = body.temple || null;
  const lens = body.lens || null;
  const category = body.category || [front, temple, lens].filter(Boolean).join("+") || null;

  const item = await prisma.pOItem.create({
    data: {
      poId,
      chineseSku: body.chineseSku || null,
      newmewSku: body.newmewSku || null,
      orderType: body.orderType || null,
      specificName: body.specificName || null,
      itemType: body.itemType || null,
      mfgType: body.mfgType || null,
      category,
      gender: body.gender || null,
      size: body.size || null,
      front,
      temple,
      lens,
      colors: Array.isArray(body.colors) ? body.colors : [],
      imageUrl: body.imageUrl || null,
      mrp: body.mrp ? parseFloat(body.mrp) : null,
      priceRangeLabel: body.priceRangeLabel || null,
      unitsOrdered: parseInt(body.unitsOrdered) || 0,
      shippedQty: parseInt(body.shippedQty) || 0,
      receivedQty: parseInt(body.receivedQty) || 0,
      materialCost: body.materialCost ? parseFloat(body.materialCost) : null,
      printingCost: body.printingCost ? parseFloat(body.printingCost) : null,
      freightCost: body.freightCost ? parseFloat(body.freightCost) : null,
      amountRMB: body.amountRMB ? parseFloat(body.amountRMB) : null,
      convRate: body.convRate ? parseFloat(body.convRate) : null,
      amountNPR: body.amountNPR ? parseFloat(body.amountNPR) : null,
      estCustomNPR: body.estCustomNPR ? parseFloat(body.estCustomNPR) : null,
      estArrivalDate: body.estArrivalDate ? new Date(body.estArrivalDate) : null,
      goodsStatus: body.goodsStatus || null,
    },
  });

  await upsertProductFromItem({
    chineseSku: item.chineseSku,
    newmewSku: item.newmewSku,
    specificName: item.specificName,
    itemType: item.itemType,
    gender: item.gender,
    size: item.size,
    front: item.front,
    temple: item.temple,
    lens: item.lens,
    mrp: item.mrp,
    imageUrl: item.imageUrl,
  });

  await recalcPoTotals(poId);
  return NextResponse.json(item, { status: 201 });
}
