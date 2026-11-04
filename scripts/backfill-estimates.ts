import { prisma } from "../src/lib/prisma";
import { recalcPoTotals, recalcShipmentDates } from "../src/lib/poTotals";

async function main() {
  const pos = await prisma.purchaseOrder.findMany({ select: { id: true, poNumber: true } });
  console.log(`Backfilling estimates for ${pos.length} POs...`);
  let done = 0;
  for (const po of pos) {
    await recalcPoTotals(po.id);
    done++;
    process.stdout.write(`\r  ${done}/${pos.length} — ${po.poNumber}`);
  }
  console.log("\nDone.");

  const shipments = await prisma.shipment.findMany({ select: { id: true } });
  console.log(`Backfilling shipment dates for ${shipments.length} shipments...`);
  done = 0;
  for (const s of shipments) {
    await recalcShipmentDates(s.id);
    done++;
    process.stdout.write(`\r  ${done}/${shipments.length}`);
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
