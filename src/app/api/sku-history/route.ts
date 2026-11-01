import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const chineseSku = new URL(req.url).searchParams.get("chineseSku")?.trim();
  if (!chineseSku) return NextResponse.json([]);

  const items = await prisma.pOItem.findMany({
    where: { chineseSku },
    include: {
      po: {
        select: {
          id: true,
          poNumber: true,
          orderDateAD: true,
          stage: true,
          onHold: true,
          cancelled: true,
          vendor: { select: { name: true } },
          shipments: {
            select: {
              id: true,
              shippingDate: true,
              arrivalDate: true,
              status: true,
              items: {
                where: { poItem: { chineseSku } },
                select: { shippedQty: true, receivedQty: true },
              },
            },
            orderBy: { shippingDate: "asc" },
          },
        },
      },
    },
    orderBy: { po: { orderDateAD: "desc" } },
  });

  const rows = items.map((item) => {
    const shipments = item.po.shipments.flatMap((sh) =>
      sh.items.map((si) => ({
        shippingDate: sh.shippingDate,
        arrivalDate: sh.arrivalDate,
        shippedQty: si.shippedQty,
        receivedQty: si.receivedQty,
        status: sh.status,
      }))
    );
    return {
      poId: item.po.id,
      poNumber: item.po.poNumber,
      vendor: item.po.vendor.name,
      orderDateAD: item.po.orderDateAD,
      stage: item.po.stage,
      onHold: item.po.onHold,
      cancelled: item.po.cancelled,
      unitsOrdered: item.unitsOrdered,
      amountRMB: item.amountRMB,
      colors: item.colors,
      size: item.size,
      mfgType: item.mfgType,
      imageUrl: item.imageUrl,
      shipments,
    };
  });

  return NextResponse.json(rows);
}
