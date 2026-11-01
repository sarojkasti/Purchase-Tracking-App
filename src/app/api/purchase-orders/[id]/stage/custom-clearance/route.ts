import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShipmentRollups, recalcShipmentDates } from "@/lib/poTotals";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body = await req.json();
  const shipmentIds: string[] = Array.isArray(body.shipmentIds) ? body.shipmentIds : [];
  const actualDate = body.actualDate ? new Date(body.actualDate) : new Date();

  if (shipmentIds.length === 0) {
    return NextResponse.json({ error: "Select at least one shipment" }, { status: 400 });
  }

  const shipments = await prisma.shipment.findMany({ where: { id: { in: shipmentIds }, poId } });
  const invalid = shipments.filter((s) => s.status !== "AT_CUSTOM");
  if (invalid.length > 0) {
    return NextResponse.json({ error: "Only shipments at Custom Arrival can be marked as cleared" }, { status: 400 });
  }

  // Clearance date must be >= custom arrival date
  const tooEarly = shipments.filter((s) => s.actualCustomArrivalDate && actualDate < s.actualCustomArrivalDate);
  if (tooEarly.length > 0) {
    const earliest = tooEarly.map((s) => s.actualCustomArrivalDate!.toISOString().slice(0, 10)).sort()[0];
    return NextResponse.json(
      { error: `Custom clearance date cannot be before custom arrival date (${earliest})` },
      { status: 400 }
    );
  }

  for (const s of shipments) {
    await prisma.shipment.update({
      where: { id: s.id },
      data: { status: "AT_CUSTOM_CLEARANCE", actualCustomDate: actualDate },
    });
    await recalcShipmentDates(s.id);
  }

  await syncShipmentRollups(poId);
  return NextResponse.json({ ok: true });
}
