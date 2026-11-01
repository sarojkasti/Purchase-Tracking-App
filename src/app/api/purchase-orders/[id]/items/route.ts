import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertProductFromItem } from "@/lib/productUpsert";
import { recalcPoTotals } from "@/lib/poTotals";
import { buildPOItemData } from "@/lib/poItemData";

async function detectOrderType(newmewSku: string | null, chineseSku: string | null, excludeItemId?: string): Promise<string> {
  if (!newmewSku && !chineseSku) return "New Order";
  const existing = await prisma.pOItem.findFirst({
    where: {
      ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
      OR: [
        newmewSku ? { newmewSku } : {},
        chineseSku ? { chineseSku } : {},
      ].filter((c) => Object.keys(c).length > 0),
    },
  });
  return existing ? "Reorder" : "New Order";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body = await req.json();

  const data = buildPOItemData(body);
  if (!data.orderType) {
    data.orderType = await detectOrderType(data.newmewSku ?? null, data.chineseSku ?? null);
  }

  const item = await prisma.pOItem.create({
    data: { ...data, poId },
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
