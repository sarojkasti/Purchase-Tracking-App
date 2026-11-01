import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const newmewSku = searchParams.get("newmewSku") || null;
  const chineseSku = searchParams.get("chineseSku") || null;
  const excludeItemId = searchParams.get("excludeItemId") || undefined;

  if (!newmewSku && !chineseSku) {
    return NextResponse.json({ orderType: "New Order" });
  }

  const existing = await prisma.pOItem.findFirst({
    where: {
      ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
      OR: [
        newmewSku ? { newmewSku } : {},
        chineseSku ? { chineseSku } : {},
      ].filter((c) => Object.keys(c).length > 0),
    },
  });

  return NextResponse.json({ orderType: existing ? "Reorder" : "New Order" });
}
