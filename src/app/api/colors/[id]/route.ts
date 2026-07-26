import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const color = await prisma.color.update({
    where: { id },
    data: { name: body.name, code: body.code },
  });
  return NextResponse.json(color);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.color.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
