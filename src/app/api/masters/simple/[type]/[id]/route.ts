import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const item = await prisma.simpleMaster.update({
    where: { id },
    data: { name: body.name, sortOrder: body.sortOrder },
  });
  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { id } = await params;
  await prisma.simpleMaster.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
