import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; shipmentId: string }> }
) {
  const { id: poId, shipmentId } = await params;
  await prisma.shipment.delete({ where: { id: shipmentId } });

  const shipments = await prisma.shipment.findMany({ where: { poId } });
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      unitsShipped: shipments.reduce((s, sh) => s + sh.shippedQty, 0),
      unitsReceived: shipments.reduce((s, sh) => s + (sh.receivedQty ?? 0), 0),
    },
  });

  return NextResponse.json({ ok: true });
}
