import { prisma } from "../src/lib/prisma";
import { recalcPoTotals } from "../src/lib/poTotals";

async function main() {
  // Find POs that have shipments but no actualFactoryShipmentDate set
  const pos = await prisma.purchaseOrder.findMany({
    where: { actualFactoryShipmentDate: null, shipments: { some: {} } },
    include: { shipments: { orderBy: { shippingDate: "asc" }, take: 1 } },
  });

  for (const po of pos) {
    const earliest = po.shipments[0];
    if (!earliest) continue;
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { actualFactoryShipmentDate: earliest.shippingDate },
    });
    await recalcPoTotals(po.id);
    console.log(`${po.poNumber}: actualFactoryShipmentDate = ${earliest.shippingDate.toISOString().slice(0, 10)}`);
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
