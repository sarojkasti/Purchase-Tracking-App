import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rateId: string }> }
) {
  const { rateId } = await params;
  await prisma.agentFreightRatePolicy.delete({ where: { id: rateId } });
  return NextResponse.json({ ok: true });
}
