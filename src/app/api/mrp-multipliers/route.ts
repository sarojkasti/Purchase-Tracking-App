import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const multipliers = await prisma.mrpMultiplier.findMany({
    orderBy: { brand: "asc" },
  });
  return NextResponse.json(multipliers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const multiplier = await prisma.mrpMultiplier.upsert({
    where: { brand: body.brand },
    update: { multiplier: parseFloat(body.multiplier) || 0 },
    create: { brand: body.brand, multiplier: parseFloat(body.multiplier) || 0 },
  });
  return NextResponse.json(multiplier, { status: 201 });
}
