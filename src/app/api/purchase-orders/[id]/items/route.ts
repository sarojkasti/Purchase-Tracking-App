import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertProductFromItem } from "@/lib/productUpsert";
import { recalcPoTotals } from "@/lib/poTotals";
import { buildPOItemData } from "@/lib/poItemData";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body = await req.json();

  const item = await prisma.pOItem.create({
    data: { ...buildPOItemData(body), poId },
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
  return NextResponse.json(item, { status: 201 });
}
