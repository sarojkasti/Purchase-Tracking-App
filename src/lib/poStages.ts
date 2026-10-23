// Two sequential pipelines share the OrderStage enum, chosen by the PO's
// mfgType (Production vs Ready Goods). Manual stages (including CUSTOM) are
// advanced one at a time by a person via "Mark: <next stage>"; SHIPPED and
// RECEIVED are derived automatically from shipment/receiving data.
export type Stage =
  | "ORDER_PLACED"
  | "START_PRODUCTION"
  | "PRINTING_PROCESS"
  | "GOODS_COMPLETED"
  | "QC"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "CUSTOM"
  | "RECEIVED";

export const PRODUCTION_STAGES: Stage[] = [
  "ORDER_PLACED",
  "START_PRODUCTION",
  "GOODS_COMPLETED",
  "QC",
  "READY_TO_SHIP",
  "SHIPPED",
  "CUSTOM",
  "RECEIVED",
];

export const READY_GOODS_STAGES: Stage[] = [
  "ORDER_PLACED",
  "PRINTING_PROCESS",
  "GOODS_COMPLETED",
  "QC",
  "READY_TO_SHIP",
  "SHIPPED",
  "CUSTOM",
  "RECEIVED",
];

export const AUTOMATIC_STAGES: ReadonlySet<Stage> = new Set(["SHIPPED", "RECEIVED"]);

// CUSTOM is manual, but advanced by picking which shipment(s) reached
// customs rather than a bare "Mark: Custom" click - different packing lists
// clear customs on different days. See markShipmentsAtCustom in poTotals.ts.
export const PICKER_STAGES: ReadonlySet<Stage> = new Set(["CUSTOM"]);

export const STAGE_LABELS: Record<Stage, string> = {
  ORDER_PLACED: "Order Placed",
  START_PRODUCTION: "Start Production",
  PRINTING_PROCESS: "Printing Process",
  GOODS_COMPLETED: "Goods Completed",
  QC: "QC",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  CUSTOM: "Custom",
  RECEIVED: "Received",
};

// The label for the date field captured when a stage is reached - distinct
// from STAGE_LABELS (the stage's own name) since the date names the event
// that happened, not the stage itself (e.g. reaching QC logs a "QC Start
// Date", not a "QC Date"). ORDER_PLACED has no date field of its own - the
// PO's orderDateAD already covers it.
export const STAGE_DATE_LABELS: Partial<Record<Stage, string>> = {
  START_PRODUCTION: "Production Start Date",
  PRINTING_PROCESS: "Printing Start Date",
  GOODS_COMPLETED: "Goods Completion Date",
  QC: "QC Start Date",
  READY_TO_SHIP: "Packing Completed Date",
  SHIPPED: "Shipped Date",
  CUSTOM: "Customs Arrival Date",
  RECEIVED: "Received Date",
};

export function stagesFor(mfgType: string | null): Stage[] {
  return mfgType === "READY_GOODS" ? READY_GOODS_STAGES : PRODUCTION_STAGES;
}

// The next stage after `current` advanceable by a single "Mark: <stage>"
// click - excludes automatic stages (SHIPPED/RECEIVED, always derived) and
// picker stages (CUSTOM, which needs shipment selection - see
// nextPickerStage) - or null if there is nothing to plain-advance to.
export function nextManualStage(current: Stage, mfgType: string | null): Stage | null {
  const stages = stagesFor(mfgType);
  const idx = stages.indexOf(current);
  if (idx === -1 || idx === stages.length - 1) return null;
  const next = stages[idx + 1];
  return AUTOMATIC_STAGES.has(next) || PICKER_STAGES.has(next) ? null : next;
}

// Whether `current` is immediately followed by a picker stage the PO can
// offer right now (e.g. SHIPPED -> CUSTOM).
export function nextPickerStage(current: Stage, mfgType: string | null): Stage | null {
  const stages = stagesFor(mfgType);
  const idx = stages.indexOf(current);
  if (idx === -1 || idx === stages.length - 1) return null;
  const next = stages[idx + 1];
  return PICKER_STAGES.has(next) ? next : null;
}

// The stage one step back from `current` in its pipeline, symmetric with
// nextManualStage - null once at the very first stage, since there is
// nothing earlier to roll back to. Automatic/picker stages CAN be rolled
// back from (that's the whole point of an undo button), just never
// advanced to by nextManualStage/nextPickerStage.
export function previousStage(current: Stage, mfgType: string | null): Stage | null {
  const stages = stagesFor(mfgType);
  const idx = stages.indexOf(current);
  if (idx <= 0) return null;
  return stages[idx - 1];
}

export function stageIndex(stage: Stage, mfgType: string | null): number {
  return stagesFor(mfgType).indexOf(stage);
}

// Maps a PO-level stage to whichever existing PurchaseOrder estimate field
// already covers it, so its actual date (see StageEvent) can be compared
// against something instead of standing alone. Most manual stages predate
// any estimate tracking and have no field - they just show the actual date.
export const STAGE_ESTIMATE_FIELD: Partial<Record<Stage, string>> = {
  GOODS_COMPLETED: "estGoodCompletionDate",
  SHIPPED: "estFactoryShipmentDate",
  CUSTOM: "estCustomArrivalDate",
  RECEIVED: "estArrivalDateAD",
};

const SHIPMENT_STAGE_ORDER = ["NOT_SHIPPED", "SHIPPED", "AT_CUSTOM", "RECEIVED"] as const;
const SHIPMENT_STAGE_LABELS: Record<(typeof SHIPMENT_STAGE_ORDER)[number], string> = {
  NOT_SHIPPED: "Ready to Ship",
  SHIPPED: "Shipped",
  AT_CUSTOM: "At Custom",
  RECEIVED: "Received",
};

// Once shipments exist, collapsing them to a single word (e.g. "Partially
// Shipped" for the least-advanced one) hides real progress on the others -
// a shipment that already cleared customs deserves to show, not disappear
// behind a shipment still just Shipped. This renders the unit quantity at
// each stage instead, e.g. "60 Shipped, 40 At Custom" - qty matters more
// here than how many separate shipments make it up. unitsOrdered minus what
// every shipment together has shipped becomes an explicit "Ready to Ship"
// bucket (e.g. 20 ordered, one shipment of 5 -> "5 Shipped, 15 Ready to
// Ship"), reusing that stage's own name since goods that haven't shipped at
// all are exactly what it means - not just a disagreement between existing
// shipments. Falls back to a plain label when there's nothing left to break out.
export function shipmentBreakdownLabel(
  shipments: { status: string; shippedQty: number }[],
  fallback: string,
  unitsOrdered = 0
): string {
  if (shipments.length === 0) return fallback;
  const qtyByStage = new Map<string, number>();
  for (const s of shipments) qtyByStage.set(s.status, (qtyByStage.get(s.status) ?? 0) + s.shippedQty);

  const totalShipped = shipments.reduce((sum, s) => sum + s.shippedQty, 0);
  const notShipped = unitsOrdered - totalShipped;
  if (notShipped > 0) qtyByStage.set("NOT_SHIPPED", notShipped);

  if (qtyByStage.size <= 1) return fallback;
  return SHIPMENT_STAGE_ORDER.filter((s) => qtyByStage.has(s))
    .map((s) => `${qtyByStage.get(s)} ${SHIPMENT_STAGE_LABELS[s]}`)
    .join(", ");
}
