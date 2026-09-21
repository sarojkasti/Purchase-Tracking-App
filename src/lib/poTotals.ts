import { prisma } from "@/lib/prisma";
import { getApplicablePaymentPolicy } from "@/lib/vendorPolicy";

const round2 = (n: number) => Math.round(n * 100) / 100;

function paymentStatus(paid: number, est: number) {
  if (paid <= 0) return "PENDING" as const;
  return paid < est ? ("PARTIAL" as const) : ("PAID" as const);
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

type DatedPo = {
  orderDateAD: Date;
  estGoodCompletionDate: Date | null;
  revisedGoodCompletionDate: Date | null;
  actualGoodCompletionDate: Date | null;
  estFactoryShipmentDate: Date | null;
  actualFactoryShipmentDate: Date | null;
};

// The date a policy trigger ("Order" / "Shipping" / "Good Completion") refers to,
// using the actual date once it exists and the latest estimate until then.
function triggerDate(trigger: string | null, po: DatedPo): Date | null {
  switch (trigger) {
    case "Order":
      return po.orderDateAD;
    case "Shipping":
      return po.actualFactoryShipmentDate ?? po.estFactoryShipmentDate;
    case "Good Completion":
      return po.actualGoodCompletionDate ?? po.revisedGoodCompletionDate ?? po.estGoodCompletionDate;
    default:
      return null;
  }
}

// Recomputes PO-level rollups from its items: quantities and PI amount
// (RMB is summed directly; NPR is summed from each item's own converted amount,
// so a per-item forex rate override still contributes correctly), then the
// estimated advance/balance amounts and due dates from the vendor's payment
// policy applied to the full PO amount (items + additional costs).
export async function recalcPoTotals(poId: string) {
  const items = await prisma.pOItem.findMany({ where: { poId } });
  const unitsOrdered = items.reduce((s, i) => s + i.unitsOrdered, 0);
  const unitsShipped = items.reduce((s, i) => s + i.shippedQty, 0);
  const unitsReceived = items.reduce((s, i) => s + i.receivedQty, 0);
  const piAmountRMB = items.reduce((s, i) => s + (i.amountRMB ?? 0), 0);
  const piAmountNPR = items.reduce((s, i) => s + (i.amountNPR ?? 0), 0);

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) return;

  const extraCostsRMB = po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB;
  const convRate = piAmountRMB ? piAmountNPR / piAmountRMB : 0;
  const poAmountRMB = piAmountRMB + extraCostsRMB;

  const policy = await getApplicablePaymentPolicy(po.vendorId, po.orderDateAD);

  // With no amount to base them on, leave any hand-entered estimates untouched.
  const amounts =
    policy && poAmountRMB > 0
      ? (() => {
          const estAdvanceRMB = round2(poAmountRMB * policy.advancePercent);
          const estBalanceRMB = round2(poAmountRMB * policy.balancePercent);
          return {
            estAdvanceRMB,
            estAdvanceNPR: round2(estAdvanceRMB * convRate),
            estBalanceRMB,
            estBalanceNPR: round2(estBalanceRMB * convRate),
          };
        })()
      : {};

  // Dates the user typed by hand are never overwritten.
  const dates: { estAdvanceDate?: Date | null; estBalanceDate?: Date | null } = {};
  if (policy) {
    if (!po.estAdvanceDateManual) dates.estAdvanceDate = triggerDate(policy.advanceOn, po);
    if (!po.estBalanceDateManual) {
      const base = triggerDate(policy.balanceFrom, po);
      dates.estBalanceDate = base ? addDays(base, policy.balanceAfterDays ?? 0) : null;
    }
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { unitsOrdered, unitsShipped, unitsReceived, piAmountRMB, piAmountNPR, ...amounts, ...dates },
  });

  // Estimates may have changed, which changes how much advance carries over.
  await syncPaymentRollups(poId);
}

// Totals the recorded payments onto the PO. Any advance paid beyond the
// estimated advance is counted toward the balance instead, so the advance is
// capped at its estimate and the excess (RMB and its proportional NPR) is added
// to the balance paid. Then refreshes both payment statuses.
export async function syncPaymentRollups(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) return;
  const payments = await prisma.payment.findMany({ where: { poId } });

  const sum = (type: string, field: "amountRMB" | "amountNPR") =>
    payments.filter((p) => p.paymentType === type).reduce((s, p) => s + p[field], 0);
  const advanceRMB = sum("ADVANCE", "amountRMB");
  const advanceNPR = sum("ADVANCE", "amountNPR");
  const balanceRMB = sum("BALANCE", "amountRMB");
  const balanceNPR = sum("BALANCE", "amountNPR");

  const carryRMB = po.estAdvanceRMB > 0 ? Math.max(advanceRMB - po.estAdvanceRMB, 0) : 0;
  const carryNPR = advanceRMB > 0 ? advanceNPR * (carryRMB / advanceRMB) : 0;

  const paidAdvanceRMB = round2(advanceRMB - carryRMB);
  const paidBalanceRMB = round2(balanceRMB + carryRMB);

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      paidAdvanceRMB,
      paidAdvanceNPR: round2(advanceNPR - carryNPR),
      advancePaymentStatus: paymentStatus(paidAdvanceRMB, po.estAdvanceRMB),
      paidBalanceRMB,
      paidBalanceNPR: round2(balanceNPR + carryNPR),
      balancePaymentStatus: paymentStatus(paidBalanceRMB, po.estBalanceRMB),
    },
  });
}
