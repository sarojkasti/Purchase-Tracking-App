import { prisma } from "@/lib/prisma";
import { getApplicablePaymentPolicy } from "@/lib/vendorPolicy";
import { nextManualStage, previousStage, type Stage } from "@/lib/poStages";

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

// The PO's total amount in RMB: item cost plus the extra landed costs.
export function poTotalAmountRMB(po: { piAmountRMB: number; printingCostRMB: number; chinaFreightCostRMB: number; inspectionCostRMB: number }) {
  return po.piAmountRMB + po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB;
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

// Records the actual date a stage was reached - once per (po, stage) for
// the PO's own manual stages, once per (shipment, stage) for a shipment's
// own Shipped/At Custom/Received progress. Defaults to today; upserts so
// re-deriving an automatic stage (e.g. recalcOrderStatus running again)
// never creates a duplicate entry or silently overwrites a date the user
// already edited to something else on this same stage.
async function recordStageEvent(poId: string, stage: string, shipmentId: string | null, actualDate?: Date) {
  const existing = await prisma.stageEvent.findFirst({ where: { poId, shipmentId, stage } });
  if (existing) return existing;
  return prisma.stageEvent.create({
    data: { poId, shipmentId, stage, actualDate: actualDate ?? new Date() },
  });
}

// A new shipment starts life already at SHIPPED, so recalcShipmentStatus
// never sees that transition happen (nothing to change) - this records its
// SHIPPED event explicitly, dated to the shipment's own shippingDate.
export async function recordShipmentCreatedEvent(poId: string, shipmentId: string, shippingDate: Date) {
  await recordStageEvent(poId, "SHIPPED", shipmentId, shippingDate);
}

// Each Shipment carries its own SHIPPED/AT_CUSTOM/RECEIVED status (different
// packing lists reach customs and arrive on different days - see
// deriveShipmentStatus). Once any shipment exists, the PO's stage is driven
// by the LEAST advanced shipment: if even one is still just SHIPPED while
// others are RECEIVED, the PO stays at SHIPPED (shown as "Partially Shipped"
// - see poStages.ts consumers for the qty-based qualifier). The PO only
// reaches RECEIVED once every shipment individually has. CUSTOM is skipped
// in this rollup when no shipment is at (or past) it - a PO doesn't sit at
// Custom just because one shipment happened to clear while the rest are
// still in transit; it only shows Custom once the least-advanced shipment
// itself is there. Every earlier manual stage is advanced by hand via the
// stage-advance API. Hold/Cancelled are independent flags layered on top.
const SHIPMENT_STAGE_ORDER: Record<string, number> = { SHIPPED: 0, AT_CUSTOM: 1, RECEIVED: 2 };

export async function recalcOrderStatus(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { shipments: true } });
  if (!po || po.onHold || po.cancelled) return;

  const current = po.stage as Stage;

  if (po.shipments.length === 0) {
    // Nothing shipped anymore (e.g. the only shipment was deleted) - fall
    // back from an automatic stage to the last manual checkpoint.
    if (current === "SHIPPED" || current === "CUSTOM" || current === "RECEIVED") {
      await prisma.purchaseOrder.update({ where: { id: poId }, data: { stage: "READY_TO_SHIP" } });
    }
    return;
  }

  if (current !== "READY_TO_SHIP" && current !== "SHIPPED" && current !== "CUSTOM" && current !== "RECEIVED") {
    // Still working through an earlier manual stage - shipments existing
    // yet doesn't pull the PO ahead of where the user has advanced it.
    return;
  }

  const leastAdvanced = po.shipments.reduce(
    (min, s) => Math.min(min, SHIPMENT_STAGE_ORDER[s.status] ?? 0),
    2
  );
  const target: Stage = leastAdvanced === 2 ? "RECEIVED" : leastAdvanced === 1 ? "CUSTOM" : "SHIPPED";

  if (target !== current) {
    await prisma.purchaseOrder.update({ where: { id: poId }, data: { stage: target } });
    await recordStageEvent(poId, target, null);
  }
}

// Advances a PO exactly one manual stage forward. Refuses to skip stages or
// to touch a PO that is on hold/cancelled or already at/past an automatic
// stage (those only move via recalcOrderStatus). Records the actual date
// reached (defaulting to today, editable afterward) alongside the stage.
export async function advanceStage(poId: string, actualDate?: Date) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
  if (!po) throw new Error("PO not found");
  if (po.onHold || po.cancelled) throw new Error("Cannot advance stage while on hold or cancelled");

  const next = nextManualStage(po.stage as Stage, po.items[0]?.mfgType ?? null);
  if (!next) throw new Error("No manual stage to advance to");

  await prisma.purchaseOrder.update({ where: { id: poId }, data: { stage: next } });
  await recordStageEvent(poId, next, null, actualDate);
  return next;
}

// Moves a PO exactly one manual stage back - symmetric with advanceStage.
// Refuses on a held/cancelled PO, at the very first stage, or once the PO
// is at a shipment-driven stage (SHIPPED/CUSTOM/RECEIVED): recalcOrderStatus
// re-derives those from the shipments on every subsequent recalc, so a
// PO-only rollback there would just get silently overwritten back to
// wherever the shipments put it. Roll those back per-shipment instead (see
// rollbackShipmentStage), which is what actually changes the driving data.
export async function rollbackStage(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
  if (!po) throw new Error("PO not found");
  if (po.onHold || po.cancelled) throw new Error("Cannot roll back stage while on hold or cancelled");

  const current = po.stage as Stage;
  if (current === "SHIPPED" || current === "CUSTOM" || current === "RECEIVED") {
    throw new Error("This stage is driven by its shipments - roll back the shipment(s) instead of the PO.");
  }

  const prev = previousStage(current, po.items[0]?.mfgType ?? null);
  if (!prev) throw new Error("Already at the first stage");

  await prisma.purchaseOrder.update({ where: { id: poId }, data: { stage: prev } });
  await prisma.stageEvent.deleteMany({ where: { poId, shipmentId: null, stage: current } });
  return prev;
}

// Marks the given shipments (packing lists) as having reached customs - a
// per-shipment action since different shipments clear on different days.
// Refuses shipments already past AT_CUSTOM (RECEIVED) or not yet SHIPPED,
// and refuses entirely on a held/cancelled PO. Re-derives the PO's overall
// stage afterward (see recalcOrderStatus: least-advanced shipment wins).
export async function markShipmentsAtCustom(poId: string, shipmentIds: string[], actualDate?: Date) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("PO not found");
  if (po.onHold || po.cancelled) throw new Error("Cannot update shipments while on hold or cancelled");

  const shipments = await prisma.shipment.findMany({ where: { id: { in: shipmentIds }, poId } });
  const invalid = shipments.filter((s) => s.status !== "SHIPPED");
  if (invalid.length > 0) throw new Error("Only shipments currently at Shipped can be marked as at Custom");

  await prisma.shipment.updateMany({ where: { id: { in: shipmentIds }, poId }, data: { status: "AT_CUSTOM" } });
  for (const id of shipmentIds) await recordStageEvent(poId, "CUSTOM", id, actualDate);
  await recalcOrderStatus(poId);
}

// Rolls a single shipment back one step: RECEIVED -> AT_CUSTOM (clearing
// receivingConfirmed and every logged receiving event, since RECEIVED is
// derived from that data and would just re-assert itself otherwise) or
// AT_CUSTOM -> SHIPPED (undoing the manual customs marking). Refuses on a
// held/cancelled PO or a shipment already at SHIPPED. Deletes the
// StageEvent for the level being left, same as the PO-level rollback.
export async function rollbackShipmentStage(poId: string, shipmentId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("PO not found");
  if (po.onHold || po.cancelled) throw new Error("Cannot roll back a shipment while on hold or cancelled");

  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, poId }, include: { items: true } });
  if (!shipment) throw new Error("Shipment not found");

  if (shipment.status === "RECEIVED") {
    await prisma.receivingEvent.deleteMany({ where: { shipmentItem: { shipmentId } } });
    await prisma.shipmentItem.updateMany({ where: { shipmentId }, data: { receivedQty: 0 } });
    await prisma.shipment.update({ where: { id: shipmentId }, data: { receivingConfirmed: false, status: "AT_CUSTOM" } });
    await prisma.stageEvent.deleteMany({ where: { shipmentId, stage: "RECEIVED" } });
  } else if (shipment.status === "AT_CUSTOM") {
    await prisma.shipment.update({ where: { id: shipmentId }, data: { status: "SHIPPED" } });
    await prisma.stageEvent.deleteMany({ where: { shipmentId, stage: "CUSTOM" } });
  } else {
    throw new Error("This shipment is already at Shipped - nothing earlier to roll back to");
  }

  await syncShipmentRollups(poId);
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

  // Estimates may have changed, which changes how much advance carries over;
  // syncPaymentRollups also re-derives the PO status as its last step.
  await syncPaymentRollups(poId);
}

// A single shipment's own status. AT_CUSTOM is a sticky manual flag (set via
// markShipmentsAtCustom) never set or cleared here. RECEIVED is derived once
// every line has fully arrived, or the user confirmed a shortfall as final
// via the receiving-mismatch popup / "Mark receipt completed" - reachable
// from either SHIPPED or AT_CUSTOM. Otherwise the status is left as-is
// (never downgraded out from under a manual AT_CUSTOM back to SHIPPED).
export function deriveShipmentStatus(shipment: {
  status: string;
  receivingConfirmed: boolean;
  items: { shippedQty: number; receivedQty: number }[];
}) {
  const fullyReceived =
    shipment.items.length > 0 && shipment.items.every((i) => i.receivedQty >= i.shippedQty);
  if (fullyReceived || shipment.receivingConfirmed) return "RECEIVED" as const;
  return shipment.status as "SHIPPED" | "AT_CUSTOM" | "RECEIVED";
}

async function recalcShipmentStatus(shipmentId: string) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, include: { items: true } });
  if (!shipment) return;
  const status = deriveShipmentStatus(shipment);
  if (status !== shipment.status) {
    await prisma.shipment.update({ where: { id: shipmentId }, data: { status } });
    await recordStageEvent(shipment.poId, status, shipmentId);
  }
}

// Adds one receiving event against a shipment line, then rolls its total
// receivedQty back up from all of that line's events - a packing list can
// arrive across several delivery dates instead of one single update.
export async function addReceivingEvent(
  shipmentItemId: string,
  data: { receivedDate: Date; receivedQty: number; notes?: string | null }
) {
  await prisma.receivingEvent.create({
    data: { shipmentItemId, receivedDate: data.receivedDate, receivedQty: data.receivedQty, notes: data.notes ?? null },
  });
  await recalcShipmentItemReceivedQty(shipmentItemId);
}

async function recalcShipmentItemReceivedQty(shipmentItemId: string) {
  const events = await prisma.receivingEvent.findMany({ where: { shipmentItemId } });
  const receivedQty = events.reduce((s, e) => s + e.receivedQty, 0);
  const line = await prisma.shipmentItem.update({ where: { id: shipmentItemId }, data: { receivedQty } });
  return line;
}

// Recomputes each item's shippedQty/receivedQty from its ShipmentItem lines
// (a PI's goods may go out across several shipments, and per-shipment qty
// can differ from what was ordered), then rolls those up onto the PO.
export async function syncShipmentRollups(poId: string) {
  const items = await prisma.pOItem.findMany({
    where: { poId },
    include: { shipmentLines: true },
  });

  for (const item of items) {
    const shippedQty = item.shipmentLines.reduce((s, l) => s + l.shippedQty, 0);
    const receivedQty = item.shipmentLines.reduce((s, l) => s + l.receivedQty, 0);
    if (shippedQty !== item.shippedQty || receivedQty !== item.receivedQty) {
      await prisma.pOItem.update({ where: { id: item.id }, data: { shippedQty, receivedQty } });
    }
  }

  const shipments = await prisma.shipment.findMany({ where: { poId } });
  for (const s of shipments) await recalcShipmentStatus(s.id);

  await recalcPoTotals(poId);
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

  await recalcOrderStatus(poId);
}
