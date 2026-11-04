import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, permissions } = await req.json();
  const role = await prisma.role.update({ where: { id }, data: { name, permissions } });
  return NextResponse.json(role);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
