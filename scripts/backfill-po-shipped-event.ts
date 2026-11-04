import { prisma } from "../src/lib/prisma";

async function main() {
  const shipments = await prisma.shipment.findMany({ orderBy: { shippingDate: "asc" } });

  for (const s of shipments) {
    const existing = await prisma.stageEvent.findFirst({
      where: { poId: s.poId, stage: "SHIPPED", shipmentId: null },
    });
    if (!existing || s.shippingDate < existing.actualDate) {
      if (existing) {
        await prisma.stageEvent.update({ where: { id: existing.id }, data: { actualDate: s.shippingDate } });
        console.log(`updated PO-level SHIPPED event for PO ${s.poId} → ${s.shippingDate.toISOString().slice(0, 10)}`);
      } else {
        await prisma.stageEvent.create({ data: { poId: s.poId, stage: "SHIPPED", actualDate: s.shippingDate } });
        console.log(`created PO-level SHIPPED event for PO ${s.poId} → ${s.shippingDate.toISOString().slice(0, 10)}`);
      }
    }
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
