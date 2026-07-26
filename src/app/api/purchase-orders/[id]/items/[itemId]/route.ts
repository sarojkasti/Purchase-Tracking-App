import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcPoTotals } from "@/lib/poTotals";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: poId, itemId } = await params;
  await prisma.pOItem.delete({ where: { id: itemId } });
  await recalcPoTotals(poId);
  return NextResponse.json({ ok: true });
}
