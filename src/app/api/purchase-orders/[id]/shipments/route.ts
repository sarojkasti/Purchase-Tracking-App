import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body = await req.json();

  const shipment = await prisma.shipment.create({
    data: {
      poId,
      shippingDate: new Date(body.shippingDate),
      transportMode: body.transportMode || "ROAD",
      shippedQty: parseInt(body.shippedQty) || 0,
      receivedQty: body.receivedQty ? parseInt(body.receivedQty) : null,
      actualCustomArrivalDate: body.actualCustomArrivalDate
        ? new Date(body.actualCustomArrivalDate)
        : null,
      actualCustomDate: body.actualCustomDate ? new Date(body.actualCustomDate) : null,
      arrivalDate: body.arrivalDate ? new Date(body.arrivalDate) : null,
      status: body.status || "SHIPPED",
      notes: body.notes || null,
    },
  });

  const shipments = await prisma.shipment.findMany({ where: { poId } });
  const unitsShipped = shipments.reduce((s, sh) => s + sh.shippedQty, 0);
  const unitsReceived = shipments.reduce((s, sh) => s + (sh.receivedQty ?? 0), 0);
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { unitsShipped, unitsReceived },
  });

  return NextResponse.json(shipment, { status: 201 });
}
