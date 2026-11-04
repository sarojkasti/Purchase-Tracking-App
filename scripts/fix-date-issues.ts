import { prisma } from "../src/lib/prisma";
import { recalcPoTotals } from "../src/lib/poTotals";

async function main() {
  // ARR-PO1.2: stale estArrivalDateAD — full recalc will fix it
  const arr12 = await prisma.purchaseOrder.findFirst({ where: { poNumber: "ARR-PO1.2" } });
  if (arr12) {
    await recalcPoTotals(arr12.id);
    const after = await prisma.purchaseOrder.findUnique({ where: { id: arr12.id } });
    console.log("ARR-PO1.2 after recalc:");
    console.log("  estCustomClearance:", after?.estCustomClearanceDate?.toISOString().slice(0, 10));
    console.log("  estArrivalDateAD:  ", after?.estArrivalDateAD?.toISOString().slice(0, 10));
  }

  // ARR-PO1.1 / FSO-PO1.1: actualFactoryShipmentDate < estGoodCompletionDate
  // These POs shipped before the goods completion estimate — clear estGoodCompletionDate
  // so it gets recalculated from the actual shipment context
  for (const poNumber of ["ARR-PO1.1", "FSO-PO1.1"]) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { poNumber },
      include: { shipments: { orderBy: { shippingDate: "asc" }, take: 1 } },
    });
    if (!po) continue;
    const shipDate = po.shipments[0]?.shippingDate;
    const goodsEst = po.actualGoodCompletionDate ?? po.estGoodCompletionDate;
    console.log(`\n${poNumber}: shipDate=${shipDate?.toISOString().slice(0,10)} goodsEst=${goodsEst?.toISOString().slice(0,10)}`);
    if (shipDate && goodsEst && shipDate < goodsEst) {
      // The goods completion estimate was set after shipping — clear it so recalc
      // won't produce a backward chain. The PO shipped before the estimate, meaning
      // the estimate is unreliable; actualFactoryShipmentDate is the ground truth.
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { estGoodCompletionDate: null },
      });
      await recalcPoTotals(po.id);
      const after = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
      console.log(`  estGoodCompletion cleared, recalculated:`);
      console.log(`  estGoodCompletionDate:   `, after?.estGoodCompletionDate?.toISOString().slice(0, 10));
      console.log(`  estFactoryShipmentDate:  `, after?.estFactoryShipmentDate?.toISOString().slice(0, 10));
      console.log(`  actualFactoryShipmentDate:`, after?.actualFactoryShipmentDate?.toISOString().slice(0, 10));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
