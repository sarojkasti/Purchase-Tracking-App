import { prisma } from "../src/lib/prisma";

async function sync(poId: string, stage: string, date: Date) {
  const ex = await prisma.stageEvent.findFirst({ where: { poId, stage, shipmentId: null } });
  if (ex) await prisma.stageEvent.update({ where: { id: ex.id }, data: { actualDate: date } });
  else await prisma.stageEvent.create({ data: { poId, stage, actualDate: date } });
}

async function main() {
  const pos = await prisma.purchaseOrder.findMany({
    where: { OR: [{ actualGoodCompletionDate: { not: null } }, { actualFactoryShipmentDate: { not: null } }] },
    select: { id: true, poNumber: true, actualGoodCompletionDate: true, actualFactoryShipmentDate: true },
  });
  for (const po of pos) {
    if (po.actualGoodCompletionDate) await sync(po.id, "GOODS_COMPLETED", po.actualGoodCompletionDate);
    if (po.actualFactoryShipmentDate) await sync(po.id, "SHIPPED", po.actualFactoryShipmentDate);
    console.log("synced", po.poNumber);
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
