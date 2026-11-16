import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.permissions?.snapshots_view && !session?.user?.permissions?.snapshots_manage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "MASTER" | "ITEMS" | null (all)

  const snapshots = await prisma.reportSnapshot.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, label: true, createdAt: true, createdBy: true },
  });

  return NextResponse.json(snapshots);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.permissions?.snapshots_manage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, label, data } = await req.json();
  if (!type || !data) return NextResponse.json({ error: "type and data required" }, { status: 400 });

  const snapshot = await prisma.reportSnapshot.create({
    data: {
      type,
      label: label || `Manual – ${new Date().toISOString().slice(0, 10)}`,
      data,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(snapshot, { status: 201 });
}
