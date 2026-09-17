import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcPoTotals } from "@/lib/poTotals";
import { upsertProductFromItem } from "@/lib/productUpsert";
import { buildPOItemData } from "@/lib/poItemData";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: poId, itemId } = await params;
  const body = await req.json();

  const { poId: _ignored, shippedQty: _shippedIgnored, receivedQty: _receivedIgnored, ...data } =
    buildPOItemData(body);
  void _ignored;
  void _shippedIgnored;
  void _receivedIgnored;

  const item = await prisma.pOItem.update({
    where: { id: itemId },
    data,
  });

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

  await recalcPoTotals(poId);
  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: poId, itemId } = await params;
  await prisma.pOItem.delete({ where: { id: itemId } });
  await recalcPoTotals(poId);
  return NextResponse.json({ ok: true });
}
