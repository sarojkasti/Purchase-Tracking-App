import { prisma } from "../src/lib/prisma";

function d(v: Date | null | undefined) { return v?.toISOString().slice(0, 10) ?? "null"; }

async function main() {
  const pos = await prisma.purchaseOrder.findMany({
    include: { shipments: { orderBy: { shippingDate: "asc" } } },
    orderBy: { poNumber: "asc" },
  });

  for (const po of pos) {
    const issues: string[] = [];

    // Check PO-level chain.
    // PO.actualCustomDate = actual customs arrival (no separate clearance actual on PO).
    // estCustomClearanceDate is derived as actualCustomDate+5 or estCustomArrival+5.
    const effectiveCustomArrival = po.actualCustomDate ?? po.estCustomArrivalDate;
    const chain: [Date | null, Date | null, string][] = [
      [po.orderDateAD, po.actualGoodCompletionDate, "actualGoodsCompletion before orderDate"],
      [po.actualGoodCompletionDate ?? po.estGoodCompletionDate, po.actualFactoryShipmentDate, "actualFactoryShipment before goodsCompletion"],
      [po.actualFactoryShipmentDate ?? po.estFactoryShipmentDate, effectiveCustomArrival, "customArrival before factoryShipment"],
      [effectiveCustomArrival, po.estCustomClearanceDate, "estCustomClearance before customArrival"],
      [po.estCustomClearanceDate, po.actualArrivalDateAD ?? po.estArrivalDateAD, "estArrival before customClearance"],
    ];
    for (const [from, to, label] of chain) {
      if (from && to && to < from) {
        issues.push(`${label}: ${d(to)} < ${d(from)}`);
      }
    }

    // Check per-shipment chain
    for (const s of po.shipments) {
      const shipChain: [Date | null, Date | null, string][] = [
        [s.shippingDate, s.estCustomArrivalDate, `Shipment ${d(s.shippingDate)}: estCustomArrival before shippingDate`],
        [s.actualCustomArrivalDate ?? s.estCustomArrivalDate, s.estCustomClearanceDate, `Shipment ${d(s.shippingDate)}: estCustomClearance before customArrival`],
        [s.estCustomClearanceDate, s.estArrivalDate, `Shipment ${d(s.shippingDate)}: estArrival before customClearance`],
      ];
      for (const [from, to, label] of shipChain) {
        if (from && to && to < from) {
          issues.push(label + `: ${d(to)} < ${d(from)}`);
        }
      }
    }

    if (issues.length > 0) {
      console.log(`\n❌ ${po.poNumber}:`);
      issues.forEach(i => console.log(`   • ${i}`));
    } else {
      console.log(`✅ ${po.poNumber}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
