import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShipmentRollups } from "@/lib/poTotals";

async function recalcShipmentItemReceivedQty(shipmentItemId: string) {
  const events = await prisma.receivingEvent.findMany({ where: { shipmentItemId } });
  const receivedQty = events.reduce((s, e) => s + e.receivedQty, 0);
  await prisma.shipmentItem.update({ where: { id: shipmentItemId }, data: { receivedQty } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; shipmentId: string; eventId: string }> }
) {
  const { id: poId, shipmentId, eventId } = await params;
  const body = await req.json();

  const event = await prisma.receivingEvent.findFirst({
    where: { id: eventId, shipmentItem: { shipmentId } },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  await prisma.receivingEvent.update({
    where: { id: eventId },
    data: {
      receivedDate: body.receivedDate ? new Date(body.receivedDate) : undefined,
      receivedQty: body.receivedQty !== undefined ? parseInt(body.receivedQty) : undefined,
      notes: body.notes !== undefined ? body.notes || null : undefined,
    },
  });

  await recalcShipmentItemReceivedQty(event.shipmentItemId);
  await syncShipmentRollups(poId);

  const updated = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { items: { include: { receivingEvents: { orderBy: { receivedDate: "asc" } } } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; shipmentId: string; eventId: string }> }
) {
  const { id: poId, shipmentId, eventId } = await params;

  const event = await prisma.receivingEvent.findFirst({
    where: { id: eventId, shipmentItem: { shipmentId } },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  await prisma.receivingEvent.delete({ where: { id: eventId } });
  await recalcShipmentItemReceivedQty(event.shipmentItemId);
  await syncShipmentRollups(poId);

  return NextResponse.json({ ok: true });
}
