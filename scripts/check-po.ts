import { prisma } from "../src/lib/prisma";

async function main() {
  const po = await prisma.purchaseOrder.findFirst({
    where: { poNumber: "ARR-PO1.2" },
    include: { items: { select: { mfgType: true } } },
  });
  if (!po) { console.log("not found"); return; }
  const d = (v: Date | null) => v?.toISOString().slice(0, 10) ?? "null";
  console.log("orderDateAD:", d(po.orderDateAD));
  console.log("mfgType:", po.items[0]?.mfgType ?? "none");
  console.log("estGoodCompletionDate:", d(po.estGoodCompletionDate));
  console.log("actualGoodCompletionDate:", d(po.actualGoodCompletionDate));
  console.log("revisedGoodCompletionDate:", d(po.revisedGoodCompletionDate));
  console.log("estFactoryShipmentDate:", d(po.estFactoryShipmentDate));
  console.log("actualFactoryShipmentDate:", d(po.actualFactoryShipmentDate));
  console.log("transportMode:", po.transportMode);
  console.log("estCustomArrivalDate:", d(po.estCustomArrivalDate));
  console.log("estCustomClearanceDate:", d(po.estCustomClearanceDate));
  console.log("estArrivalDateAD:", d(po.estArrivalDateAD));
}

main().catch(console.error).finally(() => prisma.$disconnect());
