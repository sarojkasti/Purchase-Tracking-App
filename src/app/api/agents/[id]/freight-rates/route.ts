import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const rates = await prisma.agentFreightRatePolicy.findMany({
    where: { agentId },
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json(rates);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const body = await req.json();
  const rate = await prisma.agentFreightRatePolicy.upsert({
    where: {
      agentId_effectiveFrom_itemCategory_transportMode: {
        agentId,
        effectiveFrom: new Date(body.effectiveFrom),
        itemCategory: body.itemCategory,
        transportMode: body.transportMode,
      },
    },
    update: { rate: parseFloat(body.rate) || 0 },
    create: {
      agentId,
      effectiveFrom: new Date(body.effectiveFrom),
      itemCategory: body.itemCategory,
      transportMode: body.transportMode,
      rate: parseFloat(body.rate) || 0,
    },
  });
  return NextResponse.json(rate, { status: 201 });
}
