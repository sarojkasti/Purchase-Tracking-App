import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPOItemData } from "@/lib/poItemData";
import { upsertProductFromItem } from "@/lib/productUpsert";
import { recalcPoTotals } from "@/lib/poTotals";

type BatchBody = {
  updates?: { itemId: string; data: Record<string, unknown> }[];
  creates?: Record<string, unknown>[];
  deletes?: string[];
  costs?: {
    printingCostRMB?: string | number;
    chinaFreightCostRMB?: string | number;
    inspectionCostRMB?: string | number;
  };
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body: BatchBody = await req.json();

  const deletes = body.deletes ?? [];
  const updates = body.updates ?? [];
  const creates = body.creates ?? [];

  if (deletes.length > 0) {
    await prisma.pOItem.deleteMany({ where: { id: { in: deletes }, poId } });
  }

  for (const u of updates) {
    const { poId: _ignored, shippedQty: _s, receivedQty: _r, ...data } = buildPOItemData(u.data);
    void _ignored;
    void _s;
    void _r;
    const item = await prisma.pOItem.update({ where: { id: u.itemId }, data });
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

  for (const c of creates) {
    const data = buildPOItemData(c);
    const item = await prisma.pOItem.create({ data: { ...data, poId } });
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

  if (body.costs) {
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        printingCostRMB: parseFloat(String(body.costs.printingCostRMB ?? 0)) || 0,
        chinaFreightCostRMB: parseFloat(String(body.costs.chinaFreightCostRMB ?? 0)) || 0,
        inspectionCostRMB: parseFloat(String(body.costs.inspectionCostRMB ?? 0)) || 0,
      },
    });
  }

  await recalcPoTotals(poId);

  const updated = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true },
  });
  return NextResponse.json(updated);
}
