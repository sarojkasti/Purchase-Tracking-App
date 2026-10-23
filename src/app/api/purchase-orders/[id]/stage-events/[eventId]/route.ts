import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Corrects a stage event's actual date - it defaults to today when the
// stage is reached, but a user often backfills the real date afterward.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const { id: poId, eventId } = await params;
  const body = await req.json();
  if (!body.actualDate) {
    return NextResponse.json({ error: "actualDate is required" }, { status: 400 });
  }

  const existing = await prisma.stageEvent.findFirst({ where: { id: eventId, poId } });
  if (!existing) return NextResponse.json({ error: "Stage event not found" }, { status: 404 });

  const updated = await prisma.stageEvent.update({
    where: { id: eventId },
    data: { actualDate: new Date(body.actualDate) },
  });
  return NextResponse.json(updated);
}
