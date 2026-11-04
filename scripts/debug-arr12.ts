import { prisma } from "../src/lib/prisma";

async function main() {
  const po = await prisma.purchaseOrder.findFirst({ where: { poNumber: "ARR-PO1.2" } });
  if (!po) return;
  console.log("Before recalc:");
  console.log("  estCustomClearanceDate:", po.estCustomClearanceDate?.toISOString().slice(0, 10));
  console.log("  estArrivalDateAD:      ", po.estArrivalDateAD?.toISOString().slice(0, 10));
  console.log("  actualCustomDate:      ", po.actualCustomDate?.toISOString().slice(0, 10));

  // Manually force estArrivalDateAD to correct value
  if (po.estCustomClearanceDate && po.estArrivalDateAD && po.estArrivalDateAD < po.estCustomClearanceDate) {
    const correct = new Date(Date.UTC(
      po.estCustomClearanceDate.getUTCFullYear(),
      po.estCustomClearanceDate.getUTCMonth(),
      po.estCustomClearanceDate.getUTCDate() + 5
    ));
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { estArrivalDateAD: correct },
    });
    console.log("  → fixed to:", correct.toISOString().slice(0, 10));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
