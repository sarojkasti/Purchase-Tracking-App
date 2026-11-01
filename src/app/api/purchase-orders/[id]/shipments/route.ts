import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShipmentRollups, recordShipmentCreatedEvent, recalcShipmentDates } from "@/lib/poTotals";

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

  // Shipping date must not be before goods completion
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  const shippingDate = new Date(body.shippingDate);
  const goodsDate = po?.actualGoodCompletionDate ?? po?.estGoodCompletionDate;
  if (goodsDate && shippingDate < goodsDate) {
    return NextResponse.json(
      { error: `Shipping date cannot be before goods completion date (${goodsDate.toISOString().slice(0, 10)})` },
      { status: 400 }
    );
  }

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
      customPoint: body.customPoint || null,
      notes: body.notes || null,
      items: { create: validItems },
    },
    include: { items: true },
  });

  await recordShipmentCreatedEvent(poId, shipment.id, shipment.shippingDate);
  await recalcShipmentDates(shipment.id);

  // Set actualFactoryShipmentDate on PO to the earliest shipping date across all shipments
  const earliest = await prisma.shipment.findFirst({ where: { poId }, orderBy: { shippingDate: "asc" } });
  if (earliest) {
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { actualFactoryShipmentDate: earliest.shippingDate },
    });
  }

  await syncShipmentRollups(poId);

  return NextResponse.json(shipment, { status: 201 });
}
