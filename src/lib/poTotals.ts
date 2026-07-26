import { prisma } from "@/lib/prisma";

// Recomputes PO-level rollups from its items: quantities and PI amount
// (RMB is summed directly; NPR is summed from each item's own converted amount,
// so a per-item forex rate override still contributes correctly).
export async function recalcPoTotals(poId: string) {
  const items = await prisma.pOItem.findMany({ where: { poId } });
  const unitsOrdered = items.reduce((s, i) => s + i.unitsOrdered, 0);
  const unitsShipped = items.reduce((s, i) => s + i.shippedQty, 0);
  const unitsReceived = items.reduce((s, i) => s + i.receivedQty, 0);
  const piAmountRMB = items.reduce((s, i) => s + (i.amountRMB ?? 0), 0);
  const piAmountNPR = items.reduce((s, i) => s + (i.amountNPR ?? 0), 0);

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { unitsOrdered, unitsShipped, unitsReceived, piAmountRMB, piAmountNPR },
  });
}
