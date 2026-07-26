import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const multiplier = await prisma.mrpMultiplier.update({
    where: { id },
    data: { multiplier: parseFloat(body.multiplier) || 0 },
  });
  return NextResponse.json(multiplier);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.mrpMultiplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
