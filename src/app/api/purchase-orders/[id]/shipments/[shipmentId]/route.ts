import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShipmentRollups, addReceivingEvent } from "@/lib/poTotals";

type ReceivingEventInput = { poItemId: string; receivedQty: string | number; receivedDate: string; notes?: string };

// Updates an already-shipped batch's non-quantity fields (arrival date,
// notes) and/or logs new receiving events. Goods can arrive across several
// dates, so each call here adds events rather than overwriting a single
// receivedQty - see addReceivingEvent. Status (SHIPPED/AT_CUSTOM/RECEIVED)
// is never accepted directly; it's derived afterward, except
// receivingConfirmed, which the receiving-mismatch popup / "Mark receipt
// completed" action sets explicitly.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; shipmentId: string }> }
) {
  const { id: poId, shipmentId } = await params;
  const body = await req.json();

  const existing = await prisma.shipment.findFirst({ where: { id: shipmentId, poId }, include: { items: true } });
  if (!existing) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const events: ReceivingEventInput[] = Array.isArray(body.receivingEvents) ? body.receivingEvents : [];
  const wantsReceiving = events.length > 0 || body.receivingConfirmed === true;
  // Receiving can only start once this shipment has cleared customs - it
  // must be marked AT_CUSTOM (via the PO's "Mark: Custom" picker) first.
  if (wantsReceiving && existing.status === "SHIPPED") {
    return NextResponse.json(
      { error: "This shipment hasn't been marked as at Customs yet. Mark it at Customs before logging receiving." },
      { status: 400 }
    );
  }

  for (const e of events) {
    const line = existing.items.find((i) => i.poItemId === e.poItemId);
    if (!line) continue;
    const receivedQty = parseInt(String(e.receivedQty)) || 0;
    if (receivedQty <= 0) continue;
    await addReceivingEvent(line.id, {
      receivedDate: e.receivedDate ? new Date(e.receivedDate) : new Date(),
      receivedQty,
      notes: e.notes || null,
    });
  }

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      arrivalDate: body.arrivalDate !== undefined ? (body.arrivalDate ? new Date(body.arrivalDate) : null) : undefined,
      notes: body.notes !== undefined ? body.notes || null : undefined,
      receivingConfirmed: typeof body.receivingConfirmed === "boolean" ? body.receivingConfirmed : undefined,
    },
  });

  // Re-derives this shipment's status (and the PO's) from the data just saved.
  await syncShipmentRollups(poId);

  const updated = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { items: { include: { receivingEvents: { orderBy: { receivedDate: "asc" } } } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; shipmentId: string }> }
) {
  const { id: poId, shipmentId } = await params;
  await prisma.shipment.delete({ where: { id: shipmentId } });

  await syncShipmentRollups(poId);

  return NextResponse.json({ ok: true });
}
