import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicableForexRate } from "@/lib/forexRate";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const agentId = searchParams.get("agentId");

  if (dateParam) {
    const rate = await getApplicableForexRate(agentId, new Date(dateParam));
    return NextResponse.json(rate === null ? null : { rate });
  }

  const rates = await prisma.forexRate.findMany({
    orderBy: { date: "desc" },
    include: { agent: true },
  });
  return NextResponse.json(rates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rate = await prisma.forexRate.upsert({
    where: { agentId_date: { agentId: body.agentId, date: new Date(body.date) } },
    update: { rate: parseFloat(body.rate) || 0 },
    create: { agentId: body.agentId, date: new Date(body.date), rate: parseFloat(body.rate) || 0 },
  });
  return NextResponse.json(rate, { status: 201 });
}
