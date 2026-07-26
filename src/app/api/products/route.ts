import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: { chineseSku: { contains: q, mode: "insensitive" } },
    orderBy: { chineseSku: "asc" },
    take: 10,
  });
  return NextResponse.json(products);
}
