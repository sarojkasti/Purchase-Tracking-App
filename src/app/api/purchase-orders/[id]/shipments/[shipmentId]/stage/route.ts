import { NextRequest, NextResponse } from "next/server";
import { rollbackShipmentStage } from "@/lib/poTotals";

// Rolls one shipment back a step: RECEIVED -> AT_CUSTOM or AT_CUSTOM ->
// SHIPPED - see rollbackShipmentStage in poTotals.ts.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; shipmentId: string }> }
) {
  const { id: poId, shipmentId } = await params;
  try {
    await rollbackShipmentStage(poId, shipmentId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to roll back shipment" }, { status: 400 });
  }
}
