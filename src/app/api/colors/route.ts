import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const colors = await prisma.color.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(colors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const count = await prisma.color.count();
  const color = await prisma.color.create({
    data: { name: body.name, code: body.code, sortOrder: count },
  });
  return NextResponse.json(color, { status: 201 });
}
