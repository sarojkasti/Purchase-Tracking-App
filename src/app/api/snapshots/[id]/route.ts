import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.permissions?.snapshots_view && !session?.user?.permissions?.snapshots_manage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const snapshot = await prisma.reportSnapshot.findUnique({ where: { id } });
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(snapshot);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.permissions?.snapshots_manage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.reportSnapshot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
