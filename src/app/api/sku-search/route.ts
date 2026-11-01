import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { chineseSku: { contains: q, mode: "insensitive" } },
        { newmewSku: { contains: q, mode: "insensitive" } },
        { specificName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { chineseSku: "asc" },
    take: 12,
    select: {
      chineseSku: true,
      newmewSku: true,
      specificName: true,
      brand: true,
      imageUrl: true,
    },
  });

  return NextResponse.json(products);
}
