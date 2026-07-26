import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const items = await prisma.simpleMaster.findMany({
    where: { type: type as never },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const body = await req.json();

  const count = await prisma.simpleMaster.count({ where: { type: type as never } });
  const item = await prisma.simpleMaster.create({
    data: { type: type as never, name: body.name, sortOrder: count },
  });
  return NextResponse.json(item, { status: 201 });
}
