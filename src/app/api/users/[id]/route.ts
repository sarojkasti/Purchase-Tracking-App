import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, email, password, roleId, active } = await req.json();
  const data: Record<string, unknown> = { name, email, roleId: roleId || null, active };
  if (password) data.password = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, active: true, roleId: true, role: { select: { name: true } } },
  });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
