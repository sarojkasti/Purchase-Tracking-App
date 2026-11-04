import { prisma } from "../src/lib/prisma";

async function main() {
  const events = await prisma.stageEvent.findMany({
    where: { shipmentId: null, stage: { in: ["GOODS_COMPLETED", "SHIPPED"] } },
  });
  for (const ev of events) {
    const field = ev.stage === "GOODS_COMPLETED" ? "actualGoodCompletionDate" : "actualFactoryShipmentDate";
    const po = await prisma.purchaseOrder.findUnique({ where: { id: ev.poId }, select: { [field]: true, poNumber: true } });
    if (!po) continue;
    if ((po as Record<string, unknown>)[field]) continue;
    await prisma.purchaseOrder.update({ where: { id: ev.poId }, data: { [field]: ev.actualDate } });
    console.log(`${po.poNumber}: set ${field} = ${ev.actualDate.toISOString().slice(0, 10)}`);
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
