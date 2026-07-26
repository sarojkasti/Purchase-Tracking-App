import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chineseSku: string }> }
) {
  const { chineseSku } = await params;
  const product = await prisma.product.findUnique({
    where: { chineseSku: decodeURIComponent(chineseSku) },
  });
  if (!product) return NextResponse.json(null);
  return NextResponse.json(product);
}
