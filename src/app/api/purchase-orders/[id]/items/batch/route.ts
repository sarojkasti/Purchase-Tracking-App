import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPOItemData } from "@/lib/poItemData";
import { upsertProductFromItem } from "@/lib/productUpsert";
import { recalcPoTotals } from "@/lib/poTotals";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";

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
  const session = await auth();
  const { id: poId } = await params;
  const body: BatchBody = await req.json();

  const deletes = body.deletes ?? [];
  const updates = body.updates ?? [];
  const creates = body.creates ?? [];

  // Reject saves that would leave the PO with mixed mfgTypes — a PO is either
  // entirely Ready Goods or entirely Production; mixing them breaks date estimates.
  const existingItems = await prisma.pOItem.findMany({ where: { poId }, select: { id: true, mfgType: true } });
  const surviving = existingItems.filter((i) => !deletes.includes(i.id));
  const allMfgTypes = [
    ...surviving.map((i) => updates.find((u) => u.itemId === i.id)?.data?.mfgType ?? i.mfgType),
    ...creates.map((c) => c.mfgType),
  ].filter(Boolean) as string[];
  const uniqueTypes = new Set(allMfgTypes);
  if (uniqueTypes.size > 1) {
    return NextResponse.json(
      { error: "All items in a PO must be the same manufacturing type (Ready Goods or Production). Mixed types are not allowed." },
      { status: 400 }
    );
  }

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
    data.orderType = await detectOrderType(data.newmewSku ?? null, data.chineseSku ?? null);
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

  const parts: string[] = [];
  if ((body.creates ?? []).length) parts.push(`added ${body.creates!.length} item(s)`);
  if ((body.updates ?? []).length) parts.push(`updated ${body.updates!.length} item(s)`);
  if ((body.deletes ?? []).length) parts.push(`deleted ${body.deletes!.length} item(s)`);
  if (parts.length) {
    await logAudit({ userId: session?.user?.id, userEmail: session?.user?.email ?? undefined, action: "UPDATE", entity: "Items", entityId: poId, detail: `PO ${updated?.poNumber}: ${parts.join(", ")}` });
  }

  return NextResponse.json(updated);
}
