import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShipmentRollups, recordShipmentCreatedEvent } from "@/lib/poTotals";

type ShipmentItemInput = { poItemId: string; shippedQty: string | number };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body = await req.json();

  const items: ShipmentItemInput[] = Array.isArray(body.items) ? body.items : [];
  const validItems = items
    .map((i) => ({ poItemId: i.poItemId, shippedQty: parseInt(String(i.shippedQty)) || 0 }))
    .filter((i) => i.poItemId && i.shippedQty > 0);

  if (validItems.length === 0) {
    return NextResponse.json({ error: "At least one item with a shipped quantity is required" }, { status: 400 });
  }

  const shippedQty = validItems.reduce((s, i) => s + i.shippedQty, 0);

  // A new shipment always starts at SHIPPED with nothing received yet -
  // customs and receiving are recorded afterward, per shipment, as their
  // own events (see markShipmentsAtCustom / addReceivingEvent).
  const shipment = await prisma.shipment.create({
    data: {
      poId,
      shippingDate: new Date(body.shippingDate),
      transportMode: body.transportMode || "ROAD",
      shippedQty,
      receivedQty: null,
      arrivalDate: body.arrivalDate ? new Date(body.arrivalDate) : null,
      status: "SHIPPED",
      notes: body.notes || null,
      items: { create: validItems },
    },
    include: { items: true },
  });

  await recordShipmentCreatedEvent(poId, shipment.id, shipment.shippingDate);
  await syncShipmentRollups(poId);

  return NextResponse.json(shipment, { status: 201 });
}
