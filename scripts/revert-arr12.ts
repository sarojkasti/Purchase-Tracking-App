import { prisma } from "../src/lib/prisma";
async function main() {
  const po = await prisma.purchaseOrder.findFirst({ where: { poNumber: "ARR-PO1.2" } });
  if (!po) return;
  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { estArrivalDateAD: new Date("2026-10-29") } });
  console.log("reverted estArrivalDateAD to 2026-10-29");
}
main().catch(console.error).finally(() => prisma.$disconnect());
