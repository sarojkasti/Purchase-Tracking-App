import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ranges = await prisma.mrpRange.findMany({
    orderBy: [{ brand: "asc" }, { itemType: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json(ranges);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const count = await prisma.mrpRange.count({
    where: { brand: body.brand, itemType: body.itemType },
  });
  const range = await prisma.mrpRange.create({
    data: {
      brand: body.brand,
      itemType: body.itemType,
      label: body.label,
      sortOrder: count,
    },
  });
  return NextResponse.json(range, { status: 201 });
}
