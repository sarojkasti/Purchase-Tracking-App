import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShipmentRollups, addReceivingEvent, recalcShipmentDates } from "@/lib/poTotals";

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
  if (wantsReceiving && (existing.status === "SHIPPED" || existing.status === "AT_CUSTOM")) {
    return NextResponse.json(
      { error: existing.status === "SHIPPED"
          ? "This shipment hasn't been marked as at Customs yet. Mark it at Customs Arrival before logging receiving."
          : "This shipment hasn't cleared Customs yet. Mark it as Custom Clearance before logging receiving." },
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

  // Save per-item custom rates if provided
  if (Array.isArray(body.customRates)) {
    for (const r of body.customRates as { shipmentItemId: string; rate: string | number | null }[]) {
      await prisma.shipmentItem.update({
        where: { id: r.shipmentItemId },
        data: { actualCustomRateNPR: r.rate !== null && r.rate !== "" ? parseFloat(String(r.rate)) : null },
      });
    }
  }

  // Validate shipment-level date chain
  if (body.actualCustomArrivalDate || body.actualCustomDate) {
    const customArrD = body.actualCustomArrivalDate
      ? new Date(body.actualCustomArrivalDate)
      : existing.actualCustomArrivalDate;
    const customD = body.actualCustomDate
      ? new Date(body.actualCustomDate)
      : existing.actualCustomDate;
    if (customArrD && customArrD < existing.shippingDate) {
      return NextResponse.json({ error: "Custom arrival cannot be before shipping date" }, { status: 400 });
    }
    if (customArrD && customD && customD < customArrD) {
      return NextResponse.json({ error: "Custom clearance cannot be before custom arrival" }, { status: 400 });
    }
  }

  const affectsEstimates =
    body.actualCustomArrivalDate !== undefined || body.actualCustomDate !== undefined;

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      arrivalDate: body.arrivalDate !== undefined ? (body.arrivalDate ? new Date(body.arrivalDate) : null) : undefined,
      actualCustomArrivalDate: body.actualCustomArrivalDate !== undefined ? (body.actualCustomArrivalDate ? new Date(body.actualCustomArrivalDate) : null) : undefined,
      actualCustomDate: body.actualCustomDate !== undefined ? (body.actualCustomDate ? new Date(body.actualCustomDate) : null) : undefined,
      customPoint: body.customPoint !== undefined ? body.customPoint || null : undefined,
      notes: body.notes !== undefined ? body.notes || null : undefined,
      receivingConfirmed: typeof body.receivingConfirmed === "boolean" ? body.receivingConfirmed : undefined,
    },
  });

  if (affectsEstimates) await recalcShipmentDates(shipmentId);

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

  // Delete the per-shipment StageEvent before removing the shipment
  await prisma.stageEvent.deleteMany({ where: { shipmentId } });
  await prisma.shipment.delete({ where: { id: shipmentId } });

  // Recalculate actualFactoryShipmentDate from remaining shipments
  const earliest = await prisma.shipment.findFirst({ where: { poId }, orderBy: { shippingDate: "asc" } });
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { actualFactoryShipmentDate: earliest?.shippingDate ?? null },
  });

  // Update PO-level SHIPPED StageEvent to match new earliest, or remove if no shipments left
  await prisma.stageEvent.deleteMany({ where: { poId, stage: "SHIPPED", shipmentId: null } });
  if (earliest) {
    await prisma.stageEvent.create({ data: { poId, stage: "SHIPPED", actualDate: earliest.shippingDate } });
  }

  await syncShipmentRollups(poId);

  return NextResponse.json({ ok: true });
}
