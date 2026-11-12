import { NextRequest, NextResponse } from "next/server";
import { advanceStage, rollbackStage } from "@/lib/poTotals";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// Advances a PO exactly one manual stage forward - see advanceStage in
// poTotals.ts for why this refuses to skip stages or touch a held/cancelled
// or already-automatic PO.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const actualDate = body.actualDate ? new Date(body.actualDate) : undefined;
  try {
    const stage = await advanceStage(id, actualDate);
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { poNumber: true } });
    await logAudit({ userId: session?.user?.id, userEmail: session?.user?.email ?? undefined, action: "UPDATE", entity: "PurchaseOrder", entityId: id, detail: `PO ${po?.poNumber}: status advanced to ${stage}` });
    return NextResponse.json({ stage });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to advance stage" }, { status: 400 });
  }
}

// Rolls a PO exactly one manual stage back - see rollbackStage in
// poTotals.ts.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;
  try {
    const stage = await rollbackStage(id);
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { poNumber: true } });
    await logAudit({ userId: session?.user?.id, userEmail: session?.user?.email ?? undefined, action: "UPDATE", entity: "PurchaseOrder", entityId: id, detail: `PO ${po?.poNumber}: status rolled back to ${stage}` });
    return NextResponse.json({ stage });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to roll back stage" }, { status: 400 });
  }
}
