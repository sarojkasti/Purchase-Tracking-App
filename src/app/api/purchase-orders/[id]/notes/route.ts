import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body = await req.json();
  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const note = await prisma.pONote.create({ data: { poId, content } });
  return NextResponse.json(note, { status: 201 });
}
