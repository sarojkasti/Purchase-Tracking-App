import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: poId, noteId } = await params;
  await prisma.pONote.deleteMany({ where: { id: noteId, poId } });
  return NextResponse.json({ ok: true });
}
