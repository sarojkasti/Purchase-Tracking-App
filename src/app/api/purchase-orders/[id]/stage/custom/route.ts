import { NextRequest, NextResponse } from "next/server";
import { markShipmentsAtCustom } from "@/lib/poTotals";

// Marks the selected shipment(s) as having reached customs - see
// markShipmentsAtCustom in poTotals.ts for why this is per-shipment rather
// than a single PO-wide toggle.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const shipmentIds: string[] = Array.isArray(body.shipmentIds) ? body.shipmentIds : [];
  const actualDate = body.actualDate ? new Date(body.actualDate) : undefined;
  if (shipmentIds.length === 0) {
    return NextResponse.json({ error: "Select at least one shipment" }, { status: 400 });
  }
  try {
    await markShipmentsAtCustom(id, shipmentIds, actualDate);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update shipments" }, { status: 400 });
  }
}
