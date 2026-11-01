"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  SkuAutocomplete,
  ItemImageInput,
  ColorMultiSelect,
  SearchSelect,
  strOptions,
  MFG_TYPE_OPTIONS,
  deriveCategory,
  deriveSize,
  type Product as ProductLookup,
  type Color,
} from "@/components/ItemRowInputs";
import {
  pricingAmount,
  pricingAmountText,
  pricingRateText,
  type PricingDriver,
} from "@/lib/itemPricing";
import { anyItemMissing, highlightedFields, isRowInUse } from "@/lib/itemValidation";
import { STAGE_LABELS, STAGE_DATE_LABELS, STAGE_ESTIMATE_FIELD, nextManualStage, nextPickerStage, previousStage, shipmentBreakdownLabel, stagesFor, type Stage } from "@/lib/poStages";

type Item = {
  id: string;
  chineseSku: string | null;
  newmewSku: string | null;
  orderType: string | null;
  specificName: string | null;
  itemType: string | null;
  mfgType: string | null;
  brand: string | null;
  gender: string | null;
  category: string | null;
  colors: string[];
  size: string | null;
  front: string | null;
  temple: string | null;
  lens: string | null;
  unitsOrdered: number;
  shippedQty: number;
  receivedQty: number;
  amountRMB: number | null;
  convRate: number | null;
  amountNPR: number | null;
  goodsStatus: string | null;
  imageUrl: string | null;
};

type PaymentAdvice = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
};

type PONote = {
  id: string;
  content: string;
  createdAt: string;
};

type Payment = {
  id: string;
  paymentDate: string;
  paymentType: string;
  amountRMB: number;
  exchangeRate: number;
  amountNPR: number;
  notes: string | null;
  advices: PaymentAdvice[];
};

type ReceivingEvent = {
  id: string;
  receivedDate: string;
  receivedQty: number;
  notes: string | null;
};

type ShipmentItem = {
  id: string;
  poItemId: string;
  shippedQty: number;
  receivedQty: number;
  actualCustomRateNPR: number | null;
  receivingEvents: ReceivingEvent[];
};

type ShipmentAttachment = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
};

type Shipment = {
  id: string;
  shippingDate: string;
  transportMode: string;
  shippedQty: number;
  receivedQty: number | null;
  arrivalDate: string | null;
  status: string;
  customPoint: string | null;
  notes: string | null;
  receivingConfirmed: boolean;
  items: ShipmentItem[];
  attachments: ShipmentAttachment[];
  estCustomArrivalDate: string | null;
  actualCustomArrivalDate: string | null;
  estCustomClearanceDate: string | null;
  actualCustomDate: string | null;
  estArrivalDate: string | null;
};

type Attachment = {
  id: string;
  type: "PI" | "CI" | "COSTING_SHEET" | "OTHER";
  fileName: string;
  url: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
};

type PO = {
  id: string;
  poNumber: string;
  piNumber: string | null;
  vendor: { id: string; name: string; shortName: string; agentId: string | null; agent: { id: string; name: string } | null };
  agentId: string | null;
  agent: { id: string; name: string } | null;
  orderDateAD: string;
  orderDateBS: string | null;
  stage: string;
  onHold: boolean;
  cancelled: boolean;
  transportMode: string;
  unitsOrdered: number;
  unitsShipped: number;
  unitsReceived: number;
  piAmountRMB: number;
  piAmountNPR: number;
  printingCostRMB: number;
  chinaFreightCostRMB: number;
  inspectionCostRMB: number;
  estAdvanceRMB: number;
  estAdvanceNPR: number;
  estAdvanceDate: string | null;
  estAdvanceDateManual: boolean;
  paidAdvanceRMB: number;
  paidAdvanceNPR: number;
  advancePaymentStatus: string;
  estBalanceRMB: number;
  estBalanceNPR: number;
  estBalanceDate: string | null;
  estBalanceDateManual: boolean;
  paidBalanceRMB: number;
  paidBalanceNPR: number;
  balancePaymentStatus: string;
  estGoodCompletionDate: string | null;
  actualGoodCompletionDate: string | null;
  estFactoryShipmentDate: string | null;
  actualFactoryShipmentDate: string | null;
  estCustomArrivalDate: string | null;
  actualCustomDate: string | null;
  estArrivalDateAD: string | null;
  estArrivalDateBS: string | null;
  estArrivalWeek: string | null;
  actualArrivalDateAD: string | null;
  actualArrivalWeek: string | null;
  remarks: string | null;
  items: Item[];
  payments: Payment[];
  shipments: Shipment[];
  attachments: Attachment[];
  stageEvents: StageEventRecord[];
  poNotes: PONote[];
  dateRevisions: DateRevision[];
};

type DateRevision = {
  id: string;
  field: string;
  label: string;
  fromDate: string | null;
  toDate: string | null;
  reason: string;
  createdAt: string;
};

type StageEventRecord = {
  id: string;
  shipmentId: string | null;
  stage: string;
  actualDate: string;
};

// Stage is a strictly sequential pipeline (see poStages.ts): earlier steps
// are advanced by hand one at a time, SHIPPED/CUSTOM/RECEIVED are derived
// from shipment/receiving data. Hold/Cancelled are independent flags that
// override the display without discarding the underlying stage.
const stageColors: Record<Stage, string> = {
  ORDER_PLACED: "bg-gray-100 text-gray-700",
  START_PRODUCTION: "bg-yellow-100 text-yellow-700",
  PRINTING_PROCESS: "bg-yellow-100 text-yellow-700",
  GOODS_COMPLETED: "bg-blue-100 text-blue-700",
  QC: "bg-purple-100 text-purple-700",
  READY_TO_SHIP: "bg-cyan-100 text-cyan-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  CUSTOM: "bg-orange-100 text-orange-700",
  RECEIVED: "bg-green-100 text-green-700",
};

// Once shipments exist, the stored PO stage is the LEAST advanced shipment
// (see recalcOrderStatus in poTotals.ts) - needed as one canonical DB value
// for filtering/sorting. But collapsing every shipment's progress to that
// single word hides real progress (a shipment already at Custom shouldn't
// disappear behind one still just Shipped), so the displayed label instead
// breaks shipments down by stage whenever they disagree - see
// shipmentBreakdownLabel in poStages.ts.
function stageLabel(po: { stage: string; unitsOrdered: number; shipments: { status: string; shippedQty: number }[] }) {
  const stage = po.stage as Stage;
  const label = STAGE_LABELS[stage] ?? po.stage;
  if (!["SHIPPED", "CUSTOM", "RECEIVED"].includes(stage)) return label;
  return shipmentBreakdownLabel(po.shipments, label, po.unitsOrdered);
}

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function toInputDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default function PODetailClient({
  po: initialPo,
  itemTypes,
  brands,
  genders,
  frontMaterials,
  templeMaterials,
  lensMaterials,
  colors,
  customPoints,
  agents,
}: {
  po: PO;
  itemTypes: string[];
  brands: string[];
  genders: string[];
  frontMaterials: string[];
  templeMaterials: string[];
  lensMaterials: string[];
  colors: Color[];
  customPoints: string[];
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [po, setPo] = useState(initialPo);
  const [tab, setTab] = useState<"overview" | "items" | "payments" | "ledger" | "shipping" | "history" | "attachments" | "notes">("overview");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/purchase-orders/${po.id}`);
    const data = await res.json();
    setPo(data);
    router.refresh();
  }

  async function updatePO(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Update failed");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePO() {
    if (!confirm(`Delete PO ${po.poNumber}? This cannot be undone.`)) return;
    await fetch(`/api/purchase-orders/${po.id}`, { method: "DELETE" });
    router.push("/purchase-orders");
  }

  async function handleToggleHold() {
    if (po.onHold) {
      await updatePO({ onHold: false });
    } else {
      if (!confirm(`Put PO ${po.poNumber} on hold?`)) return;
      await updatePO({ onHold: true });
    }
  }

  async function handleToggleCancelled() {
    if (po.cancelled) {
      if (!confirm("Restore this PO back to normal?")) return;
      await updatePO({ cancelled: false });
    } else {
      if (!confirm(`Cancel PO ${po.poNumber}?`)) return;
      await updatePO({ cancelled: true });
    }
  }

  const mfgType = po.items[0]?.mfgType ?? null;
  const nextStage = nextManualStage(po.stage as Stage, mfgType);
  const pickerStage = nextPickerStage(po.stage as Stage, mfgType);
  // SHIPPED/CUSTOM/RECEIVED are re-derived from the PO's shipments on every
  // recalc, so a PO-level rollback there would just get silently overwritten
  // back - roll back the shipment(s) themselves instead (their own "Undo"
  // button, in the Shipping tab).
  const isShipmentDriven = po.stage === "SHIPPED" || po.stage === "CUSTOM" || po.stage === "RECEIVED";
  const priorStage = isShipmentDriven ? null : previousStage(po.stage as Stage, mfgType);
  const paused = po.onHold || po.cancelled;
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showClearancePicker, setShowClearancePicker] = useState(false);
  const [showReceivingModal, setShowReceivingModal] = useState(false);
  const hasClearancePending = po.shipments.some((s) => s.status === "AT_CUSTOM");
  const hasReceivable = po.shipments.some((s) => {
    if (s.status === "AT_CUSTOM_CLEARANCE") return true;
    if (s.status === "RECEIVED" && !s.receivingConfirmed) {
      const fullyReceived = s.items.every((line) => line.receivedQty >= line.shippedQty);
      return !fullyReceived;
    }
    return false;
  });
  const [showAdvancePopover, setShowAdvancePopover] = useState(false);
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0, 10));

  async function handleAdvanceStage() {
    if (!nextStage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualDate: advanceDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to advance stage");
      }
      setShowAdvancePopover(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleRollbackStage() {
    if (!priorStage) return;
    if (!confirm(`Roll this PO back to ${STAGE_LABELS[priorStage]}? Its recorded date for the current stage will be removed.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/stage`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to roll back stage");
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold font-mono">{po.poNumber}</h1>
          <p className="text-sm text-gray-500">
            {po.vendor.name} · PI: {po.piNumber ?? "-"} · Order Date: {fmtDate(po.orderDateAD)}
            {po.orderDateBS ? ` (BS ${po.orderDateBS})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded text-sm font-medium ${
              po.cancelled
                ? "bg-red-100 text-red-700"
                : po.onHold
                ? "bg-amber-100 text-amber-700"
                : stageColors[po.stage as Stage] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {po.cancelled ? "Cancelled" : po.onHold ? "On Hold" : stageLabel(po)}
          </span>
          {!paused && po.shipments.some((s) => s.status === "AT_CUSTOM_CLEARANCE") && (
            <span className="px-2.5 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200">
              Pending Receipt
            </span>
          )}
          {!paused && priorStage && (
            <button
              onClick={handleRollbackStage}
              disabled={saving}
              title={`Roll back to ${STAGE_LABELS[priorStage]}`}
              className="rounded border border-gray-300 text-gray-600 text-sm px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          {!paused && nextStage && (
            <div className="relative">
              <button
                onClick={() => {
                  setAdvanceDate(new Date().toISOString().slice(0, 10));
                  setShowAdvancePopover((v) => !v);
                }}
                disabled={saving}
                className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
              >
                Mark: {STAGE_LABELS[nextStage]}
              </button>
              {showAdvancePopover && (
                <div className="absolute right-0 mt-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
                  <label className="block mb-2">
                    <span className="block text-xs font-medium text-gray-500 mb-1">
                      {STAGE_DATE_LABELS[nextStage] ?? "Date reached"}
                    </span>
                    <input
                      type="date"
                      className="input"
                      value={advanceDate}
                      onChange={(e) => setAdvanceDate(e.target.value)}
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAdvancePopover(false)}
                      className="text-xs text-gray-500 hover:underline px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdvanceStage}
                      disabled={saving}
                      className="rounded bg-gray-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!paused && pickerStage && (
            <button
              onClick={() => setShowCustomPicker(true)}
              disabled={saving}
              className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
            >
              Mark: {STAGE_LABELS[pickerStage]}
            </button>
          )}
          {!paused && hasClearancePending && (
            <button
              onClick={() => setShowClearancePicker(true)}
              disabled={saving}
              className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
            >
              Mark: Custom Clearance
            </button>
          )}
          {!paused && hasReceivable && (
            <button
              onClick={() => setShowReceivingModal(true)}
              disabled={saving}
              className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
            >
              Update Receiving
            </button>
          )}
          <button onClick={handleToggleHold} disabled={saving || po.cancelled} className="text-sm text-amber-700 hover:underline disabled:opacity-50">
            {po.onHold ? "Resume" : "Put on Hold"}
          </button>
          <button onClick={handleToggleCancelled} disabled={saving} className="text-sm text-gray-600 hover:underline disabled:opacity-50">
            {po.cancelled ? "Restore" : "Cancel PO"}
          </button>
          <button onClick={handleDeletePO} className="text-red-600 text-sm hover:underline">
            Delete PO
          </button>
        </div>
      </div>

      {showCustomPicker && (
        <CustomPickerModal
          po={po}
          onClose={() => setShowCustomPicker(false)}
          onDone={async () => {
            setShowCustomPicker(false);
            await refresh();
          }}
        />
      )}
      {showClearancePicker && (
        <ClearancePickerModal
          po={po}
          onClose={() => setShowClearancePicker(false)}
          onDone={async () => {
            setShowClearancePicker(false);
            await refresh();
          }}
        />
      )}
      {showReceivingModal && (
        <ReceivingModal
          po={po}
          onClose={() => setShowReceivingModal(false)}
          onDone={async () => {
            setShowReceivingModal(false);
            await refresh();
          }}
        />
      )}

      <div className="flex gap-1 border-b mb-4">
        {(["overview", "items", "payments", "ledger", "shipping", "history", "attachments", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${
              tab === t ? "border-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t} {t === "items" && `(${po.items.length})`}
            {t === "payments" && `(${po.payments.length})`}
            {t === "shipping" && `(${po.shipments.length})`}
            {t === "attachments" && `(${po.attachments.length})`}
            {t === "notes" && po.poNotes.length > 0 && `(${po.poNotes.length})`}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab po={po} onUpdate={updatePO} agents={agents} />}
      {tab === "history" && <HistoryTab po={po} onRefresh={refresh} />}
      {tab === "items" && (
        <ItemsTab
          po={po}
          onRefresh={refresh}
          itemTypes={itemTypes}
          brands={brands}
          genders={genders}
          frontMaterials={frontMaterials}
          templeMaterials={templeMaterials}
          lensMaterials={lensMaterials}
          colors={colors}
        />
      )}
      {tab === "payments" && <PaymentsTab po={po} onRefresh={refresh} />}
      {tab === "ledger" && <LedgerTab po={po} />}
      {tab === "shipping" && <ShippingTab po={po} onRefresh={refresh} customPoints={customPoints} />}
      {tab === "attachments" && <AttachmentsTab po={po} onRefresh={refresh} />}
      {tab === "notes" && <NotesTab po={po} onRefresh={refresh} />}

      <style jsx global>{`
        .field-invalid .input {
          border-color: #dc2626;
          background-color: #fef2f2;
        }
        .field-invalid button {
          border-color: #dc2626;
          background-color: #fef2f2;
          color: #dc2626;
        }
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          padding: 0.4rem 0.6rem;
          font-size: 0.8125rem;
        }
        .input:focus {
          outline: 2px solid #111827;
          outline-offset: -1px;
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function OverviewTab({
  po,
  onUpdate,
  agents,
}: {
  po: PO;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  agents: { id: string; name: string }[];
}) {
  const [dates, setDates] = useState({
    estGoodCompletionDate: toInputDate(po.estGoodCompletionDate),
    actualGoodCompletionDate: toInputDate(po.actualGoodCompletionDate),
    estFactoryShipmentDate: toInputDate(po.estFactoryShipmentDate),
    actualFactoryShipmentDate: toInputDate(po.actualFactoryShipmentDate),
    estCustomArrivalDate: toInputDate(po.estCustomArrivalDate),
    actualCustomDate: toInputDate(po.actualCustomDate),
    estArrivalDateAD: toInputDate(po.estArrivalDateAD),
    estArrivalWeek: po.estArrivalWeek ?? "",
    actualArrivalDateAD: toInputDate(po.actualArrivalDateAD),
    actualArrivalWeek: po.actualArrivalWeek ?? "",
  });

  const advancePaidTotalRMB = po.payments
    .filter((p) => p.paymentType === "ADVANCE")
    .reduce((s, p) => s + p.amountRMB, 0);
  const advancePaidTotalNPR = po.payments
    .filter((p) => p.paymentType === "ADVANCE")
    .reduce((s, p) => s + p.amountNPR, 0);
  const balancePaidTotalRMB = po.payments
    .filter((p) => p.paymentType === "BALANCE")
    .reduce((s, p) => s + p.amountRMB, 0);
  const balancePaidTotalNPR = po.payments
    .filter((p) => p.paymentType === "BALANCE")
    .reduce((s, p) => s + p.amountNPR, 0);
  const advanceCarriedRMB =
    Math.round(Math.max(advancePaidTotalRMB - po.estAdvanceRMB, 0) * 100) / 100;
  const advanceCarriedNPR =
    advancePaidTotalRMB > 0 ? Math.round((advancePaidTotalNPR * advanceCarriedRMB / advancePaidTotalRMB) * 100) / 100 : 0;
  const effectivePaidAdvanceRMB = advancePaidTotalRMB - advanceCarriedRMB;
  const effectivePaidAdvanceNPR = advancePaidTotalNPR - advanceCarriedNPR;
  const effectivePaidBalanceRMB = balancePaidTotalRMB + advanceCarriedRMB;
  const effectivePaidBalanceNPR = balancePaidTotalNPR + advanceCarriedNPR;

  const extraCostsRMB = po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB;
  const totalPOAmountRMB = po.piAmountRMB + extraCostsRMB;
  const convRate = po.piAmountRMB ? po.piAmountNPR / po.piAmountRMB : 0;
  const totalPOAmountNPR = po.piAmountNPR + extraCostsRMB * convRate;

  const effectiveAgentId = po.agentId ?? po.vendor.agentId;
  const [details, setDetails] = useState({
    piNumber: po.piNumber ?? "",
    orderDateAD: toInputDate(po.orderDateAD),
    transportMode: po.transportMode,
    agentId: po.agentId ?? "",
  });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const detailsChanged =
    details.piNumber !== (po.piNumber ?? "") ||
    details.orderDateAD !== toInputDate(po.orderDateAD) ||
    details.transportMode !== po.transportMode ||
    details.agentId !== (po.agentId ?? "");

  async function saveDetails() {
    if (!details.piNumber.trim() || !details.orderDateAD) {
      setDetailsError("CHN PI No and Order Date are required.");
      return;
    }
    setDetailsError(null);
    setDetailsSaving(true);
    try {
      await onUpdate({
        piNumber: details.piNumber.trim(),
        orderDateAD: details.orderDateAD,
        transportMode: details.transportMode,
        agentId: details.agentId || null,
      });
    } catch {
      setDetailsError("Failed to save PO details.");
    } finally {
      setDetailsSaving(false);
    }
  }

  const isPartialShipping =
    (po.unitsOrdered > 0 && po.unitsShipped > 0 && po.unitsShipped < po.unitsOrdered) ||
    stageLabel(po).startsWith("Partially");
  const shippedItems = po.items.filter((i) => i.shippedQty > 0);
  const pendingItems = po.items.filter((i) => i.unitsOrdered - i.shippedQty > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Units Ordered" value={po.unitsOrdered.toLocaleString()} />
        <StatCard label="Units Shipped" value={po.unitsShipped.toLocaleString()} />
        <StatCard label="Units Received" value={po.unitsReceived.toLocaleString()} />
        <StatCard
          label="PO Amount"
          value={`¥${totalPOAmountRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`NPR ${totalPOAmountNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
      </div>

      {isPartialShipping && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border rounded p-4">
            <h3 className="text-sm font-medium mb-2 text-indigo-700">Shipped ({shippedItems.length} items)</h3>
            <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
              {shippedItems.map((i) => (
                <div key={i.id} className="flex justify-between border-b pb-1">
                  <span className="font-mono">{i.chineseSku ?? "-"}</span>
                  <span className="text-gray-500">
                    {i.shippedQty} / {i.unitsOrdered}
                  </span>
                </div>
              ))}
              {shippedItems.length === 0 && <div className="text-gray-400">None shipped yet.</div>}
            </div>
          </div>
          <div className="bg-white border rounded p-4">
            <h3 className="text-sm font-medium mb-2 text-amber-700">Pending ({pendingItems.length} items)</h3>
            <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
              {pendingItems.map((i) => (
                <div key={i.id} className="flex justify-between border-b pb-1">
                  <span className="font-mono">{i.chineseSku ?? "-"}</span>
                  <span className="text-gray-500">{i.unitsOrdered - i.shippedQty} remaining</span>
                </div>
              ))}
              {pendingItems.length === 0 && <div className="text-gray-400">Nothing pending.</div>}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded p-4">
        <h3 className="text-sm font-medium mb-3">PO Details</h3>
        <div className="grid grid-cols-5 gap-4 items-end">
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">CHN PI No</span>
            <input
              className="input"
              value={details.piNumber}
              onChange={(e) => setDetails({ ...details, piNumber: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Order Date</span>
            <input
              type="date"
              className="input"
              value={details.orderDateAD}
              onChange={(e) => setDetails({ ...details, orderDateAD: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Transport Mode</span>
            <select
              className="input"
              value={details.transportMode}
              onChange={(e) => setDetails({ ...details, transportMode: e.target.value })}
            >
              <option value="ROAD">Road</option>
              <option value="AIRWAY">Airway</option>
              <option value="SEA">Sea / Waterway</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">
              Agent
              {effectiveAgentId && !details.agentId && (
                <span className="ml-1 text-gray-400">(from vendor)</span>
              )}
            </span>
            <select
              className="input"
              value={details.agentId}
              onChange={(e) => setDetails({ ...details, agentId: e.target.value })}
            >
              <option value="">— use vendor default —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveDetails}
              disabled={detailsSaving || !detailsChanged}
              className="rounded bg-gray-900 text-white text-sm px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50"
            >
              {detailsSaving ? "Saving..." : "Save"}
            </button>
            {detailsError && <span className="text-red-600 text-xs">{detailsError}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded p-4">
          <h3 className="text-sm font-medium mb-3">Advance Payment</h3>
          <Row label="Estimated" value={`¥${po.estAdvanceRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / NPR ${po.estAdvanceNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <Row
            label="Est. Date"
            value={
              <EstDateField
                key={`${po.estAdvanceDate}-${po.estAdvanceDateManual}`}
                date={po.estAdvanceDate}
                manual={po.estAdvanceDateManual}
                onSave={(v) => onUpdate({ estAdvanceDate: v })}
              />
            }
          />
          <Row label="Paid" value={`¥${effectivePaidAdvanceRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / NPR ${effectivePaidAdvanceNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <Row
            label="Status"
            value={
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  po.advancePaymentStatus === "PAID"
                    ? "bg-green-100 text-green-700"
                    : po.advancePaymentStatus === "PARTIAL"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {po.advancePaymentStatus}
              </span>
            }
          />
        </div>
        <div className="bg-white border rounded p-4">
          <h3 className="text-sm font-medium mb-3">Balance Payment</h3>
          <Row label="Estimated" value={`¥${po.estBalanceRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / NPR ${po.estBalanceNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <Row
            label="Est. Date"
            value={
              <EstDateField
                key={`${po.estBalanceDate}-${po.estBalanceDateManual}`}
                date={po.estBalanceDate}
                manual={po.estBalanceDateManual}
                onSave={(v) => onUpdate({ estBalanceDate: v })}
              />
            }
          />
          <Row label="Paid" value={`¥${effectivePaidBalanceRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / NPR ${effectivePaidBalanceNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <Row
            label="Status"
            value={
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  po.balancePaymentStatus === "PAID"
                    ? "bg-green-100 text-green-700"
                    : po.balancePaymentStatus === "PARTIAL"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {po.balancePaymentStatus}
              </span>
            }
          />
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <h3 className="text-sm font-medium mb-3">Lifecycle Timeline</h3>
        <div className="grid grid-cols-4 gap-4">
          <DatePairField
            label="Good Completion"
            estValue={dates.estGoodCompletionDate}
            savedEstValue={toInputDate(po.estGoodCompletionDate)}
            actualValue={dates.actualGoodCompletionDate}
            onEstChange={(v) => setDates({ ...dates, estGoodCompletionDate: v })}
            onActualChange={(v) => setDates({ ...dates, actualGoodCompletionDate: v })}
            onSave={() =>
              onUpdate({
                estGoodCompletionDate: dates.estGoodCompletionDate || null,
                actualGoodCompletionDate: dates.actualGoodCompletionDate || null,
              })
            }
            onSaveWithReason={(reason) =>
              onUpdate({
                estGoodCompletionDate: dates.estGoodCompletionDate || null,
                actualGoodCompletionDate: dates.actualGoodCompletionDate || null,
                estGoodCompletionDateReason: reason,
              })
            }
          />
          <DatePairField
            label="Factory Shipment"
            estValue={dates.estFactoryShipmentDate}
            actualValue={dates.actualFactoryShipmentDate}
            onEstChange={(v) => setDates({ ...dates, estFactoryShipmentDate: v })}
            onActualChange={(v) => setDates({ ...dates, actualFactoryShipmentDate: v })}
            onSave={() =>
              onUpdate({
                estFactoryShipmentDate: dates.estFactoryShipmentDate || null,
                actualFactoryShipmentDate: dates.actualFactoryShipmentDate || null,
              })
            }
          />
          <DatePairField
            label="Customs"
            estValue={dates.estCustomArrivalDate}
            actualValue={dates.actualCustomDate}
            onEstChange={(v) => setDates({ ...dates, estCustomArrivalDate: v })}
            onActualChange={(v) => setDates({ ...dates, actualCustomDate: v })}
            onSave={() =>
              onUpdate({
                estCustomArrivalDate: dates.estCustomArrivalDate || null,
                actualCustomDate: dates.actualCustomDate || null,
              })
            }
          />
          <div>
            <DatePairField
              label="Nepal Arrival"
              estValue={dates.estArrivalDateAD}
              actualValue={dates.actualArrivalDateAD}
              onEstChange={(v) => setDates({ ...dates, estArrivalDateAD: v })}
              onActualChange={(v) => setDates({ ...dates, actualArrivalDateAD: v })}
              onSave={() =>
                onUpdate({
                  estArrivalDateAD: dates.estArrivalDateAD || null,
                  estArrivalWeek: dates.estArrivalWeek || null,
                  actualArrivalDateAD: dates.actualArrivalDateAD || null,
                  actualArrivalWeek: dates.actualArrivalWeek || null,
                })
              }
            />
            <label className="block text-[11px] text-gray-400 mt-1">Est. Week</label>
            <input
              className="input mb-1"
              placeholder="auto from date"
              value={dates.estArrivalWeek}
              onChange={(e) => setDates({ ...dates, estArrivalWeek: e.target.value })}
              onBlur={() => onUpdate({ estArrivalWeek: dates.estArrivalWeek || null })}
            />
            <label className="block text-[11px] text-gray-400">Actual Week</label>
            <input
              className="input"
              placeholder="auto from date"
              value={dates.actualArrivalWeek}
              onChange={(e) => setDates({ ...dates, actualArrivalWeek: e.target.value })}
              onBlur={() => onUpdate({ actualArrivalWeek: dates.actualArrivalWeek || null })}
            />
          </div>
        </div>
      </div>

      {po.remarks && (
        <div className="bg-white border rounded p-4">
          <h3 className="text-sm font-medium mb-2">Remarks</h3>
          <p className="text-sm text-gray-600">{po.remarks}</p>
        </div>
      )}
    </div>
  );
}

function DatePairField({
  label,
  estValue,
  savedEstValue,
  actualValue,
  onEstChange,
  onActualChange,
  onSave,
  onSaveWithReason,
}: {
  label: string;
  estValue: string;
  savedEstValue?: string;
  actualValue: string;
  onEstChange: (v: string) => void;
  onActualChange: (v: string) => void;
  onSave: () => void;
  onSaveWithReason?: (reason: string) => void;
}) {
  const [pendingReason, setPendingReason] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function handleEstBlur() {
    if (onSaveWithReason && savedEstValue !== undefined && estValue !== savedEstValue && estValue) {
      setPendingReason("");
      setReason("");
    } else {
      onSave();
    }
  }

  function confirmWithReason() {
    if (!reason.trim()) return;
    onSaveWithReason!(reason.trim());
    setPendingReason(null);
    setReason("");
  }

  function cancelReason() {
    onEstChange(savedEstValue ?? "");
    setPendingReason(null);
    setReason("");
  }

  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <label className="block text-[11px] text-gray-400">Est.</label>
      <input
        type="date"
        className="input mb-1"
        value={estValue}
        onChange={(e) => onEstChange(e.target.value)}
        onBlur={handleEstBlur}
      />
      {pendingReason !== null && (
        <div className="mb-1 p-2 border border-amber-300 bg-amber-50 rounded text-xs space-y-1">
          <div className="font-medium text-amber-800">Reason for changing Est. date?</div>
          <input
            autoFocus
            className="input w-full"
            placeholder="e.g. Factory delay, raw material shortage…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmWithReason(); if (e.key === "Escape") cancelReason(); }}
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={confirmWithReason}
              disabled={!reason.trim()}
              className="rounded bg-gray-900 text-white px-2 py-0.5 disabled:opacity-40"
            >Save</button>
            <button type="button" onClick={cancelReason} className="rounded border px-2 py-0.5 text-gray-600">Cancel</button>
          </div>
        </div>
      )}
      <label className="block text-[11px] text-gray-400">Actual</label>
      <input type="date" className="input" value={actualValue} onChange={(e) => onActualChange(e.target.value)} onBlur={onSave} />
    </div>
  );
}

function EstDateField({
  date,
  manual,
  onSave,
}: {
  date: string | null;
  manual: boolean;
  onSave: (v: string | null) => Promise<void>;
}) {
  const current = toInputDate(date);
  const [value, setValue] = useState(current);
  return (
    <div className="flex items-center justify-end gap-2">
      <input
        type="date"
        className="input"
        style={{ width: "9.5rem" }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== current) void onSave(value || null);
        }}
      />
      {date && <span className="text-[11px] text-gray-400">{manual ? "manual" : "auto"}</span>}
      {manual && (
        <button type="button" onClick={() => void onSave(null)} className="text-[11px] text-blue-600 hover:underline">
          Reset
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

type EditableItemRow = {
  chineseSku: string;
  newmewSku: string;
  orderType: string;
  specificName: string;
  itemType: string;
  brand: string;
  mfgType: string;
  gender: string;
  front: string;
  temple: string;
  lens: string;
  colors: string[];
  sizeLens: string;
  sizeBridge: string;
  sizeTemple: string;
  unitsOrdered: string;
  rateRMB: string;
  amountRMB: string;
  pricingDriver: PricingDriver;
  convRate: string;
  imageUrl: string;
};

function itemToRow(item: Item): EditableItemRow {
  const [sizeLens, sizeBridge, sizeTemple] = (item.size ?? "").split("-");
  return {
    chineseSku: item.chineseSku ?? "",
    newmewSku: item.newmewSku ?? "",
    orderType: item.orderType ?? "",
    specificName: item.specificName ?? "",
    itemType: item.itemType ?? "Sunglasses",
    brand: item.brand ?? "",
    mfgType: item.mfgType ?? "READY_GOODS",
    gender: item.gender ?? "",
    front: item.front ?? "",
    temple: item.temple ?? "",
    lens: item.lens ?? "",
    colors: item.colors,
    sizeLens: sizeLens || "",
    sizeBridge: sizeBridge || "",
    sizeTemple: sizeTemple || "",
    unitsOrdered: String(item.unitsOrdered),
    rateRMB: item.unitsOrdered ? String((item.amountRMB ?? 0) / item.unitsOrdered) : "",
    amountRMB: item.amountRMB ? String(item.amountRMB) : "",
    pricingDriver: "rate",
    convRate: item.convRate ? String(item.convRate) : "",
    imageUrl: item.imageUrl ?? "",
  };
}

function emptyNewItemRow(defaultConvRate: string): EditableItemRow {
  return {
    chineseSku: "",
    newmewSku: "",
    orderType: "New Order",
    specificName: "",
    itemType: "Sunglasses",
    brand: "",
    mfgType: "READY_GOODS",
    gender: "",
    front: "",
    temple: "",
    lens: "",
    colors: [],
    sizeLens: "",
    sizeBridge: "",
    sizeTemple: "",
    unitsOrdered: "",
    rateRMB: "",
    amountRMB: "",
    pricingDriver: "rate",
    convRate: defaultConvRate,
    imageUrl: "",
  };
}

const rowAmountRMB = pricingAmount;

function ItemsTab({
  po,
  onRefresh,
  itemTypes,
  brands,
  genders,
  frontMaterials,
  templeMaterials,
  lensMaterials,
  colors,
}: {
  po: PO;
  onRefresh: () => Promise<void>;
  itemTypes: string[];
  brands: string[];
  genders: string[];
  frontMaterials: string[];
  templeMaterials: string[];
  lensMaterials: string[];
  colors: Color[];
}) {
  const [defaultConvRate, setDefaultConvRate] = useState("");
  const [rows, setRows] = useState<Record<string, EditableItemRow>>(() =>
    Object.fromEntries(po.items.map((item) => [item.id, itemToRow(item)]))
  );
  const [newRows, setNewRows] = useState<(EditableItemRow & { key: string })[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const existingErrs = (itemId: string, row: EditableItemRow) =>
    highlightedFields(row, showErrors, pendingDeletes.has(itemId));
  const newErrs = (row: EditableItemRow) => highlightedFields(row, showErrors, !isRowInUse(row));

  const [costs, setCosts] = useState({
    printingCostRMB: String(po.printingCostRMB || ""),
    chinaFreightCostRMB: String(po.chinaFreightCostRMB || ""),
    inspectionCostRMB: String(po.inspectionCostRMB || ""),
  });

  useEffect(() => {
    setRows(Object.fromEntries(po.items.map((item) => [item.id, itemToRow(item)])));
    setNewRows([]);
    setPendingDeletes(new Set());
    setCosts({
      printingCostRMB: String(po.printingCostRMB || ""),
      chinaFreightCostRMB: String(po.chinaFreightCostRMB || ""),
      inspectionCostRMB: String(po.inspectionCostRMB || ""),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po.id, po.items, po.printingCostRMB, po.chinaFreightCostRMB, po.inspectionCostRMB]);

  useEffect(() => {
    const date = po.orderDateAD.slice(0, 10);
    const url = po.vendor.agentId
      ? `/api/forex?date=${date}&agentId=${po.vendor.agentId}`
      : `/api/forex?date=${date}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data?.rate) setDefaultConvRate(String(data.rate));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems = po.items.filter((item) => !pendingDeletes.has(item.id));

  const extraCostsRMB =
    (parseFloat(costs.printingCostRMB) || 0) +
    (parseFloat(costs.chinaFreightCostRMB) || 0) +
    (parseFloat(costs.inspectionCostRMB) || 0);
  const itemsAmountRMB =
    visibleItems.reduce((s, item) => s + rowAmountRMB(rows[item.id] ?? itemToRow(item)), 0) +
    newRows.reduce((s, r) => s + rowAmountRMB(r), 0);
  const totalPOAmountRMB = itemsAmountRMB + extraCostsRMB;
  const costsConvRate = po.piAmountRMB ? po.piAmountNPR / po.piAmountRMB : 0;
  const itemsAmountNPR = costsConvRate ? itemsAmountRMB * costsConvRate : po.piAmountNPR;
  const totalPOAmountNPR = itemsAmountNPR + extraCostsRMB * costsConvRate;

  function updateExistingRow(itemId: string, patch: Partial<EditableItemRow>) {
    setRows((r) => ({ ...r, [itemId]: { ...r[itemId], ...patch } }));
  }

  function updateNewRow(key: string, patch: Partial<EditableItemRow>) {
    setNewRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function refreshOrderType(
    skuParams: { newmewSku?: string; chineseSku?: string },
    excludeItemId: string | undefined,
    apply: (orderType: string) => void
  ) {
    const qs = new URLSearchParams();
    if (skuParams.newmewSku) qs.set("newmewSku", skuParams.newmewSku);
    if (skuParams.chineseSku) qs.set("chineseSku", skuParams.chineseSku);
    if (excludeItemId) qs.set("excludeItemId", excludeItemId);
    const res = await fetch(`/api/purchase-orders/check-sku?${qs}`);
    const data = await res.json();
    apply(data.orderType);
  }

  function applySkuSelect(row: EditableItemRow, product: ProductLookup): EditableItemRow {
    const [sizeLens, sizeBridge, sizeTemple] = (product.size ?? "").split("-");
    // mfgType is intentionally left untouched — it's always user-editable,
    // even when the rest of the row is auto-filled from the SKU master.
    return {
      ...row,
      chineseSku: product.chineseSku,
      newmewSku: product.newmewSku ?? row.newmewSku,
      specificName: product.specificName ?? row.specificName,
      itemType: product.itemType ?? row.itemType,
      brand: product.brand ?? row.brand,
      gender: product.gender ?? row.gender,
      sizeLens: sizeLens || row.sizeLens,
      sizeBridge: sizeBridge || row.sizeBridge,
      sizeTemple: sizeTemple || row.sizeTemple,
      front: product.front ?? row.front,
      temple: product.temple ?? row.temple,
      lens: product.lens ?? row.lens,
      imageUrl: product.imageUrl ?? row.imageUrl,
    };
  }

  async function handleExistingImageUpload(itemId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return;
    const data = await res.json();
    updateExistingRow(itemId, { imageUrl: data.url });
  }

  async function handleNewRowImageUpload(key: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return;
    const data = await res.json();
    updateNewRow(key, { imageUrl: data.url });
  }

  function markForDelete(itemId: string) {
    if (!confirm("Remove this item? It will be deleted when you click Save.")) return;
    setPendingDeletes((s) => new Set(s).add(itemId));
  }

  function unmarkForDelete(itemId: string) {
    setPendingDeletes((s) => {
      const next = new Set(s);
      next.delete(itemId);
      return next;
    });
  }

  function addNewRow(afterKey?: string) {
    const fresh = { ...emptyNewItemRow(defaultConvRate), key: `${Date.now()}-${Math.random()}` };
    setNewRows((rows) => {
      const at = afterKey ? rows.findIndex((r) => r.key === afterKey) + 1 : rows.length;
      return [...rows.slice(0, at), fresh, ...rows.slice(at)];
    });
  }

  function removeNewRow(key: string) {
    setNewRows((rows) => rows.filter((r) => r.key !== key));
  }

  async function handleSavePO() {
    const hasMissing = anyItemMissing([
      ...po.items.filter((item) => !pendingDeletes.has(item.id)).map((item) => rows[item.id] ?? itemToRow(item)),
      ...newRows.filter(isRowInUse),
    ]);
    if (hasMissing) {
      setShowErrors(true);
      setTimeout(() => {
        document.querySelector(".field-invalid")?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      }, 50);
      return;
    }
    setShowErrors(false);
    setSaving(true);
    setError(null);
    try {
      const updates = Object.entries(rows)
        .filter(([itemId]) => !pendingDeletes.has(itemId))
        .map(([itemId, row]) => {
          const category = deriveCategory(row.front, row.temple, row.lens);
          const size = deriveSize(row.sizeLens, row.sizeBridge, row.sizeTemple);
          const amountRMB = rowAmountRMB(row);
          const amountNPR = amountRMB && row.convRate ? amountRMB * parseFloat(row.convRate) : undefined;
          return { itemId, data: { ...row, category, size, amountRMB, amountNPR } };
        });

      const creates = newRows
        .filter((r) => r.chineseSku || r.specificName || r.unitsOrdered)
        .map((r) => {
          const category = deriveCategory(r.front, r.temple, r.lens);
          const size = deriveSize(r.sizeLens, r.sizeBridge, r.sizeTemple);
          const amountRMB = rowAmountRMB(r);
          const amountNPR = amountRMB && r.convRate ? amountRMB * parseFloat(r.convRate) : undefined;
          return { ...r, category, size, amountRMB, amountNPR };
        });

      const res = await fetch(`/api/purchase-orders/${po.id}/items/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates,
          creates,
          deletes: Array.from(pendingDeletes),
          costs,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to save changes");
      }
      setNewRows([]);
      setPendingDeletes(new Set());
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Chinese SKU doubles as a product master — start typing to pick a previously used SKU and
        its details auto-fill. Category is derived automatically from Front + Temple + Lens.
        Edits, new rows, deletions, and additional costs are all staged locally — click{" "}
        <strong>Save PO</strong> below to apply everything at once.
      </p>

      <div className="overflow-x-auto">
        <table className="text-sm border rounded border-separate border-spacing-0">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-2 py-1.5 min-w-[9rem]">Chinese SKU <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[9rem]">Newmew SKU</th>
              <th className="px-2 py-1.5 min-w-[8rem]">Order Type</th>
              <th className="px-2 py-1.5 min-w-[11rem]">Name</th>
              <th className="px-2 py-1.5 min-w-[8rem]">Type <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Brand <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Mfg Type <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[7rem]">Front <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[7rem]">Temple <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[7rem]">Lens <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Category</th>
              <th className="px-2 py-1.5 min-w-[7rem]">Gender</th>
              <th className="px-2 py-1.5 min-w-[10rem]">Colors <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[13rem]">Size (L-B-T) <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[6rem]">Units <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[7rem]">RMB Rate <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Amount RMB <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Amount NPR</th>
              <th className="px-2 py-1.5 min-w-[4rem]">Image</th>
              <th className="px-2 py-1.5 w-16 sticky right-0 bg-gray-100 z-10"></th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item) => {
              const row = rows[item.id] ?? itemToRow(item);
              const isPendingDelete = pendingDeletes.has(item.id);
              return (
                <tr key={item.id} className={`border-t ${isPendingDelete ? "opacity-40" : ""}`}>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("chineseSku") ? "field-invalid" : ""}`}>
                    <SkuAutocomplete
                      value={row.chineseSku}
                      onChange={(v) => {
                        updateExistingRow(item.id, { chineseSku: v });
                        refreshOrderType({ chineseSku: v, newmewSku: row.newmewSku }, item.id, (orderType) =>
                          updateExistingRow(item.id, { orderType })
                        );
                      }}
                      onSelect={(product) => {
                        const updated = applySkuSelect(row, product);
                        setRows((r) => ({ ...r, [item.id]: updated }));
                        refreshOrderType({ chineseSku: product.chineseSku, newmewSku: product.newmewSku ?? row.newmewSku }, item.id, (orderType) =>
                          updateExistingRow(item.id, { orderType })
                        );
                      }}
                      required
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      className="input"
                      value={row.newmewSku}
                      onChange={(e) => updateExistingRow(item.id, { newmewSku: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={row.orderType}
                      onChange={(e) => updateExistingRow(item.id, { orderType: e.target.value })}
                    >
                      <option value="New Order">New Order</option>
                      <option value="Reorder">Reorder</option>
                    </select>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      className="input"
                      value={row.specificName}
                      onChange={(e) => updateExistingRow(item.id, { specificName: e.target.value })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("itemType") ? "field-invalid" : ""}`}>
                    <SearchSelect
                      value={row.itemType}
                      options={strOptions(itemTypes)}
                      allowEmpty={false}
                      onChange={(v) => updateExistingRow(item.id, { itemType: v })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("brand") ? "field-invalid" : ""}`}>
                    <SearchSelect
                      value={row.brand}
                      options={strOptions(brands)}
                      onChange={(v) => updateExistingRow(item.id, { brand: v })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("mfgType") ? "field-invalid" : ""}`}>
                    <SearchSelect
                      value={row.mfgType}
                      options={MFG_TYPE_OPTIONS}
                      allowEmpty={false}
                      onChange={(v) => updateExistingRow(item.id, { mfgType: v })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("front") ? "field-invalid" : ""}`}>
                    <SearchSelect
                      value={row.front}
                      options={strOptions(frontMaterials)}
                      onChange={(v) => updateExistingRow(item.id, { front: v })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("temple") ? "field-invalid" : ""}`}>
                    <SearchSelect
                      value={row.temple}
                      options={strOptions(templeMaterials)}
                      onChange={(v) => updateExistingRow(item.id, { temple: v })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("lens") ? "field-invalid" : ""}`}>
                    <SearchSelect
                      value={row.lens}
                      options={strOptions(lensMaterials)}
                      onChange={(v) => updateExistingRow(item.id, { lens: v })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input className="input bg-gray-50" value={deriveCategory(row.front, row.temple, row.lens)} disabled />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <SearchSelect
                      value={row.gender}
                      options={strOptions(genders)}
                      onChange={(v) => updateExistingRow(item.id, { gender: v })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("colors") ? "field-invalid" : ""}`}>
                    <ColorMultiSelect
                      colors={colors}
                      selected={row.colors}
                      onChange={(selected) => updateExistingRow(item.id, { colors: selected })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("size") ? "field-invalid" : ""}`}>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="input size-box"
                        placeholder="56"
                        value={row.sizeLens}
                        onChange={(e) => updateExistingRow(item.id, { sizeLens: e.target.value.slice(0, 2) })}
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        className="input size-box"
                        placeholder="19"
                        value={row.sizeBridge}
                        onChange={(e) => updateExistingRow(item.id, { sizeBridge: e.target.value.slice(0, 2) })}
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        className="input size-box"
                        placeholder="148"
                        value={row.sizeTemple}
                        onChange={(e) => updateExistingRow(item.id, { sizeTemple: e.target.value.slice(0, 3) })}
                      />
                    </div>
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("units") ? "field-invalid" : ""}`}>
                    <input
                      type="number"
                      className="input"
                      value={row.unitsOrdered}
                      onChange={(e) => updateExistingRow(item.id, { unitsOrdered: e.target.value })}
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("price") ? "field-invalid" : ""}`}>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={pricingRateText(row)}
                      onChange={(e) =>
                        updateExistingRow(item.id, { rateRMB: e.target.value, pricingDriver: "rate" })
                      }
                    />
                  </td>
                  <td className={`px-1 py-1 align-top ${existingErrs(item.id, row).has("price") ? "field-invalid" : ""}`}>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={pricingAmountText(row)}
                      onChange={(e) =>
                        updateExistingRow(item.id, { amountRMB: e.target.value, pricingDriver: "amount" })
                      }
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      className="input bg-gray-50"
                      value={
                        rowAmountRMB(row) && row.convRate
                          ? (rowAmountRMB(row) * parseFloat(row.convRate)).toFixed(2)
                          : ""
                      }
                      disabled
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <ItemImageInput
                      imageUrl={row.imageUrl}
                      onUpload={(file) => handleExistingImageUpload(item.id, file)}
                      onClear={() => updateExistingRow(item.id, { imageUrl: "" })}
                    />
                  </td>
                  <td className="px-1 py-1 text-center align-top sticky right-0 bg-white border-l border-gray-200 z-10">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => addNewRow()}
                        className="w-6 h-6 flex items-center justify-center rounded text-blue-600 hover:bg-blue-50"
                        title="Add row below"
                      >＋</button>
                      {isPendingDelete ? (
                        <button
                          type="button"
                          onClick={() => unmarkForDelete(item.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 text-xs"
                          title="Undo delete"
                        >↩</button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markForDelete(item.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:bg-red-50"
                          title="Delete row"
                        >🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {newRows.map((newRow) => (
            <tr key={newRow.key} className="border-t bg-gray-50/50">
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("chineseSku") ? "field-invalid" : ""}`}>
                <SkuAutocomplete
                  value={newRow.chineseSku}
                  onChange={(v) => {
                    updateNewRow(newRow.key, { chineseSku: v });
                    refreshOrderType({ chineseSku: v, newmewSku: newRow.newmewSku }, undefined, (orderType) =>
                      updateNewRow(newRow.key, { orderType })
                    );
                  }}
                  onSelect={(product) => {
                    updateNewRow(newRow.key, applySkuSelect(newRow, product));
                    refreshOrderType({ chineseSku: product.chineseSku, newmewSku: product.newmewSku ?? newRow.newmewSku }, undefined, (orderType) =>
                      updateNewRow(newRow.key, { orderType })
                    );
                  }}
                />
              </td>
              <td className="px-1 py-1 align-top">
                <input
                  className="input"
                  value={newRow.newmewSku}
                  onChange={(e) => updateNewRow(newRow.key, { newmewSku: e.target.value })}
                />
              </td>
              <td className="px-1 py-1 align-top">
                <select
                  className="input"
                  value={newRow.orderType}
                  onChange={(e) => updateNewRow(newRow.key, { orderType: e.target.value })}
                >
                  <option value="New Order">New Order</option>
                  <option value="Reorder">Reorder</option>
                </select>
              </td>
              <td className="px-1 py-1 align-top">
                <input
                  className="input"
                  value={newRow.specificName}
                  onChange={(e) => updateNewRow(newRow.key, { specificName: e.target.value })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("itemType") ? "field-invalid" : ""}`}>
                <SearchSelect
                  value={newRow.itemType}
                  options={strOptions(itemTypes)}
                  allowEmpty={false}
                  onChange={(v) => updateNewRow(newRow.key, { itemType: v })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("brand") ? "field-invalid" : ""}`}>
                <SearchSelect
                  value={newRow.brand}
                  options={strOptions(brands)}
                  onChange={(v) => updateNewRow(newRow.key, { brand: v })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("mfgType") ? "field-invalid" : ""}`}>
                <SearchSelect
                  value={newRow.mfgType}
                  options={MFG_TYPE_OPTIONS}
                  allowEmpty={false}
                  onChange={(v) => updateNewRow(newRow.key, { mfgType: v })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("front") ? "field-invalid" : ""}`}>
                <SearchSelect
                  value={newRow.front}
                  options={strOptions(frontMaterials)}
                  onChange={(v) => updateNewRow(newRow.key, { front: v })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("temple") ? "field-invalid" : ""}`}>
                <SearchSelect
                  value={newRow.temple}
                  options={strOptions(templeMaterials)}
                  onChange={(v) => updateNewRow(newRow.key, { temple: v })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("lens") ? "field-invalid" : ""}`}>
                <SearchSelect
                  value={newRow.lens}
                  options={strOptions(lensMaterials)}
                  onChange={(v) => updateNewRow(newRow.key, { lens: v })}
                />
              </td>
              <td className="px-1 py-1 align-top">
                <input className="input bg-gray-50" value={deriveCategory(newRow.front, newRow.temple, newRow.lens)} disabled />
              </td>
              <td className="px-1 py-1 align-top">
                <SearchSelect
                  value={newRow.gender}
                  options={strOptions(genders)}
                  onChange={(v) => updateNewRow(newRow.key, { gender: v })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("colors") ? "field-invalid" : ""}`}>
                <ColorMultiSelect
                  colors={colors}
                  selected={newRow.colors}
                  onChange={(selected) => updateNewRow(newRow.key, { colors: selected })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("size") ? "field-invalid" : ""}`}>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="input size-box"
                    placeholder="56"
                    value={newRow.sizeLens}
                    onChange={(e) => updateNewRow(newRow.key, { sizeLens: e.target.value.slice(0, 2) })}
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    className="input size-box"
                    placeholder="19"
                    value={newRow.sizeBridge}
                    onChange={(e) => updateNewRow(newRow.key, { sizeBridge: e.target.value.slice(0, 2) })}
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    className="input size-box"
                    placeholder="148"
                    value={newRow.sizeTemple}
                    onChange={(e) => updateNewRow(newRow.key, { sizeTemple: e.target.value.slice(0, 3) })}
                  />
                </div>
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("units") ? "field-invalid" : ""}`}>
                <input
                  type="number"
                  className="input"
                  value={newRow.unitsOrdered}
                  onChange={(e) => updateNewRow(newRow.key, { unitsOrdered: e.target.value })}
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("price") ? "field-invalid" : ""}`}>
                <input
                  type="number"
                  step="any"
                  className="input"
                  value={pricingRateText(newRow)}
                  onChange={(e) =>
                    updateNewRow(newRow.key, { rateRMB: e.target.value, pricingDriver: "rate" })
                  }
                />
              </td>
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("price") ? "field-invalid" : ""}`}>
                <input
                  type="number"
                  step="any"
                  className="input"
                  value={pricingAmountText(newRow)}
                  onChange={(e) =>
                    updateNewRow(newRow.key, { amountRMB: e.target.value, pricingDriver: "amount" })
                  }
                />
              </td>
              <td className="px-1 py-1 align-top">
                <input
                  className="input bg-gray-50"
                  value={
                    rowAmountRMB(newRow) && newRow.convRate
                      ? (rowAmountRMB(newRow) * parseFloat(newRow.convRate)).toFixed(2)
                      : ""
                  }
                  disabled
                />
              </td>
              <td className="px-1 py-1 align-top">
                <ItemImageInput
                  imageUrl={newRow.imageUrl}
                  onUpload={(file) => handleNewRowImageUpload(newRow.key, file)}
                  onClear={() => updateNewRow(newRow.key, { imageUrl: "" })}
                />
              </td>
              <td className="px-1 py-1 text-center align-top sticky right-0 bg-gray-50 border-l border-gray-200 z-10">
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => addNewRow(newRow.key)}
                    className="w-6 h-6 flex items-center justify-center rounded text-blue-600 hover:bg-blue-50"
                    title="Add row below"
                  >＋</button>
                  <button
                    type="button"
                    onClick={() => removeNewRow(newRow.key)}
                    className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:bg-red-50"
                    title="Remove row"
                  >🗑</button>
                </div>
              </td>
            </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleItems.length === 0 && newRows.length === 0 && (
        <button
          type="button"
          onClick={() => addNewRow()}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add Item Row
        </button>
      )}

      <div className="bg-white border rounded p-4">
        <h3 className="text-sm font-medium mb-3">Additional Costs (RMB)</h3>
        <div className="grid grid-cols-4 gap-4 items-end">
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Printing Cost</span>
            <input
              type="number"
              step="0.01"
              className="input"
              value={costs.printingCostRMB}
              onChange={(e) => setCosts({ ...costs, printingCostRMB: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">China Freight Cost</span>
            <input
              type="number"
              step="0.01"
              className="input"
              value={costs.chinaFreightCostRMB}
              onChange={(e) => setCosts({ ...costs, chinaFreightCostRMB: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Inspection Cost</span>
            <input
              type="number"
              step="0.01"
              className="input"
              value={costs.inspectionCostRMB}
              onChange={(e) => setCosts({ ...costs, inspectionCostRMB: e.target.value })}
            />
          </label>
          <div>
            <span className="block text-xs text-gray-500 mb-1">Total PO Amount</span>
            <div className="text-sm font-semibold">
              ¥{totalPOAmountRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="block text-xs text-gray-400 font-normal">
                NPR {totalPOAmountNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div>
        <button
          type="button"
          onClick={handleSavePO}
          disabled={saving}
          className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save PO"}
        </button>
      </div>

      <style jsx global>{`
        .size-box {
          width: 3.25rem;
          padding-left: 0.25rem;
          padding-right: 0.25rem;
          text-align: center;
        }
        .size-box::-webkit-outer-spin-button,
        .size-box::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .size-box {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}

type LedgerRow = {
  key: string;
  date: string | null;
  particular: string;
  dr: number;
  drNPR: number;
  cr: number;
  crNPR: number;
};

function LedgerTable({ rows, emptyLabel }: { rows: LedgerRow[]; emptyLabel: string }) {
  const fmtRMB = (n: number) => `¥${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtNPR = (n: number) => `NPR ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  let balRMB = 0;
  let balNPR = 0;
  const withBalance = rows.map((row) => {
    balRMB = r2(balRMB + row.cr - row.dr);
    balNPR = r2(balNPR + row.crNPR - row.drNPR);
    return { ...row, balRMB, balNPR };
  });

  const totalDr = r2(rows.reduce((s, r) => s + r.dr, 0));
  const totalDrNPR = r2(rows.reduce((s, r) => s + r.drNPR, 0));
  const totalCr = r2(rows.reduce((s, r) => s + r.cr, 0));
  const totalCrNPR = r2(rows.reduce((s, r) => s + r.crNPR, 0));

  return (
    <div className="bg-white rounded border overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Particular</th>
            <th className="px-3 py-2 text-right">Dr</th>
            <th className="px-3 py-2 text-right">Cr</th>
            <th className="px-3 py-2 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {withBalance.map((row) => (
            <tr key={row.key} className="border-t">
              <td className="px-3 py-2">{row.date ? fmtDate(row.date) : "-"}</td>
              <td className="px-3 py-2">{row.particular}</td>
              <td className="px-3 py-2 text-right">
                {row.dr > 0 ? (
                  <>
                    {fmtRMB(row.dr)} <span className="text-gray-400">/ {fmtNPR(row.drNPR)}</span>
                  </>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {row.cr > 0 ? (
                  <>
                    {fmtRMB(row.cr)} <span className="text-gray-400">/ {fmtNPR(row.crNPR)}</span>
                  </>
                ) : (
                  "-"
                )}
              </td>
              <td className={`px-3 py-2 text-right font-medium ${row.balRMB > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmtRMB(row.balRMB)} <span className="font-normal text-gray-400">/ {fmtNPR(row.balNPR)}</span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t bg-gray-50 font-medium">
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right">
                {fmtRMB(totalDr)} <span className="font-normal text-gray-400">/ {fmtNPR(totalDrNPR)}</span>
              </td>
              <td className="px-3 py-2 text-right">
                {fmtRMB(totalCr)} <span className="font-normal text-gray-400">/ {fmtNPR(totalCrNPR)}</span>
              </td>
              <td className={`px-3 py-2 text-right ${balRMB > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmtRMB(balRMB)} <span className="font-normal text-gray-400">/ {fmtNPR(balNPR)}</span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function LedgerTab({ po }: { po: PO }) {
  const [ledger, setLedger] = useState<"total" | "due">("total");
  const [mode, setMode] = useState<"summary" | "details">("details");
  const [showNotYetDue, setShowNotYetDue] = useState(false);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const convRate = po.piAmountRMB ? po.piAmountNPR / po.piAmountRMB : 0;
  const extraCostsRMB = po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB;
  const totalPOAmountRMB = po.piAmountRMB + extraCostsRMB;
  const totalPOAmountNPR = po.piAmountNPR + extraCostsRMB * convRate;

  const sortedPayments = [...po.payments].sort(
    (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );

  // Total Ledger: PO amount is a Cr (what's owed to the vendor), each payment
  // is a Dr against it. Balance = amount still payable.
  const totalDetailRows: LedgerRow[] = [
    {
      key: "po-amount",
      date: po.orderDateAD,
      particular: "PO Amount",
      dr: 0,
      drNPR: 0,
      cr: totalPOAmountRMB,
      crNPR: totalPOAmountNPR,
    },
    ...sortedPayments.map((p) => ({
      key: p.id,
      date: p.paymentDate,
      particular: `Payment (${p.paymentType})${p.notes ? ` - ${p.notes}` : ""}`,
      dr: p.amountRMB,
      drNPR: p.amountNPR,
      cr: 0,
      crNPR: 0,
    })),
  ];

  const totalPaidRMB = r2(sortedPayments.reduce((s, p) => s + p.amountRMB, 0));
  const totalPaidNPR = r2(sortedPayments.reduce((s, p) => s + p.amountNPR, 0));
  const totalSummaryRows: LedgerRow[] = [
    { key: "po-amount", date: po.orderDateAD, particular: "PO Amount", dr: 0, drNPR: 0, cr: totalPOAmountRMB, crNPR: totalPOAmountNPR },
    { key: "payments", date: null, particular: "Payments Made", dr: totalPaidRMB, drNPR: totalPaidNPR, cr: 0, crNPR: 0 },
  ];

  // Due Ledger: only entries whose estimated due date has passed. Advance
  // paid beyond its estimate is carried over to the balance (same rule the
  // server applies in syncPaymentRollups), so paidAdvanceRMB/paidBalanceRMB
  // already reflect that adjustment rather than raw payments by type.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastDue = (d: string | null) => !!d && new Date(d) <= today;

  const advanceRawRMB = r2(sortedPayments.filter((p) => p.paymentType === "ADVANCE").reduce((s, p) => s + p.amountRMB, 0));
  const advanceCarryRMB = po.estAdvanceRMB > 0 ? r2(Math.max(advanceRawRMB - po.estAdvanceRMB, 0)) : 0;

  const advanceDueRMB = r2(Math.max(po.estAdvanceRMB - effectivePaidAdvanceRMB, 0));
  const advanceDueNPR = r2(Math.max(po.estAdvanceNPR - po.paidAdvanceNPR, 0));
  const balanceDueRMB = r2(Math.max(po.estBalanceRMB - effectivePaidBalanceRMB, 0));
  const balanceDueNPR = r2(Math.max(po.estBalanceNPR - po.paidBalanceNPR, 0));

  const advanceIsPastDue = isPastDue(po.estAdvanceDate);
  const balanceIsPastDue = isPastDue(po.estBalanceDate);

  // Payments against advance/balance are shown up to what actually applies to
  // that bucket: any advance overpayment is carried into the balance section
  // instead, both as an explicit adjustment line and by capping the advance
  // payment rows shown at the estimate.
  let advanceAllocated = 0;
  const advancePaymentRows: LedgerRow[] = [];
  sortedPayments
    .filter((p) => p.paymentType === "ADVANCE")
    .forEach((p) => {
      const remaining = po.estAdvanceRMB > 0 ? Math.max(po.estAdvanceRMB - advanceAllocated, 0) : p.amountRMB;
      const applied = Math.min(p.amountRMB, remaining);
      advanceAllocated = r2(advanceAllocated + applied);
      if (applied > 0) {
        const share = applied / p.amountRMB;
        advancePaymentRows.push({
          key: p.id,
          date: p.paymentDate,
          particular: `Advance Payment${p.notes ? ` - ${p.notes}` : ""}`,
          dr: r2(applied),
          drNPR: r2(p.amountNPR * share),
          cr: 0,
          crNPR: 0,
        });
      }
    });

  const balancePaymentRows: LedgerRow[] = sortedPayments
    .filter((p) => p.paymentType === "BALANCE")
    .map((p) => ({
      key: p.id,
      date: p.paymentDate,
      particular: `Balance Payment${p.notes ? ` - ${p.notes}` : ""}`,
      dr: p.amountRMB,
      drNPR: p.amountNPR,
      cr: 0,
      crNPR: 0,
    }));
  if (advanceCarryRMB > 0) {
    const carryNPR = advanceRawRMB > 0 ? r2(sortedPayments.filter((p) => p.paymentType === "ADVANCE").reduce((s, p) => s + p.amountNPR, 0) * (advanceCarryRMB / advanceRawRMB)) : 0;
    balancePaymentRows.push({
      key: "adv-carry",
      date: null,
      particular: "Advance Overpayment Adjusted to Balance",
      dr: advanceCarryRMB,
      drNPR: carryNPR,
      cr: 0,
      crNPR: 0,
    });
  }

  const dueDetailAdvance: LedgerRow[] =
    po.estAdvanceRMB > 0 && advanceIsPastDue
      ? [
          {
            key: "adv-est",
            date: po.estAdvanceDate,
            particular: "Advance Due (Estimated)",
            dr: 0,
            drNPR: 0,
            cr: po.estAdvanceRMB,
            crNPR: po.estAdvanceNPR,
          },
          ...advancePaymentRows,
        ]
      : [];

  const dueDetailBalance: LedgerRow[] =
    po.estBalanceRMB > 0 && balanceIsPastDue
      ? [
          {
            key: "bal-est",
            date: po.estBalanceDate,
            particular: "Balance Due (Estimated)",
            dr: 0,
            drNPR: 0,
            cr: po.estBalanceRMB,
            crNPR: po.estBalanceNPR,
          },
          ...balancePaymentRows,
        ]
      : [];

  const dueSummaryRows: LedgerRow[] = [];
  if (po.estAdvanceRMB > 0 && advanceIsPastDue) {
    dueSummaryRows.push({
      key: "advance",
      date: po.estAdvanceDate,
      particular: "Advance",
      dr: po.paidAdvanceRMB,
      drNPR: po.paidAdvanceNPR,
      cr: po.estAdvanceRMB,
      crNPR: po.estAdvanceNPR,
    });
  }
  if (po.estBalanceRMB > 0 && balanceIsPastDue) {
    dueSummaryRows.push({
      key: "balance",
      date: po.estBalanceDate,
      particular: "Balance",
      dr: po.paidBalanceRMB,
      drNPR: po.paidBalanceNPR,
      cr: po.estBalanceRMB,
      crNPR: po.estBalanceNPR,
    });
  }

  const totalDueRMB = r2((advanceIsPastDue ? advanceDueRMB : 0) + (balanceIsPastDue ? balanceDueRMB : 0));
  const totalDueNPR = r2((advanceIsPastDue ? advanceDueNPR : 0) + (balanceIsPastDue ? balanceDueNPR : 0));

  // Not-yet-due: the flip side of the past-due filter above, kept collapsed
  // and shown only as a summary total until the user asks to see it.
  const notYetDueRows: (LedgerRow & { dueDate: string | null })[] = [];
  if (po.estAdvanceRMB > 0 && !advanceIsPastDue) {
    notYetDueRows.push({
      key: "advance",
      date: po.estAdvanceDate,
      dueDate: po.estAdvanceDate,
      particular: "Advance",
      dr: po.paidAdvanceRMB,
      drNPR: po.paidAdvanceNPR,
      cr: po.estAdvanceRMB,
      crNPR: po.estAdvanceNPR,
    });
  }
  if (po.estBalanceRMB > 0 && !balanceIsPastDue) {
    notYetDueRows.push({
      key: "balance",
      date: po.estBalanceDate,
      dueDate: po.estBalanceDate,
      particular: "Balance",
      dr: po.paidBalanceRMB,
      drNPR: po.paidBalanceNPR,
      cr: po.estBalanceRMB,
      crNPR: po.estBalanceNPR,
    });
  }
  const notYetDueRMB = r2(notYetDueRows.reduce((s, r) => s + Math.max(r.cr - r.dr, 0), 0));
  const notYetDueNPR = r2(notYetDueRows.reduce((s, r) => s + Math.max(r.crNPR - r.drNPR, 0), 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b">
          {(["total", "due"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setLedger(v)}
              className={`px-3 py-1.5 text-sm capitalize border-b-2 -mb-px ${
                ledger === v ? "border-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {v} Ledger
            </button>
          ))}
        </div>
        <div className="flex gap-1 text-sm">
          {(["summary", "details"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded capitalize ${
                mode === m ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {ledger === "total" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="PO Amount (Cr)" value={`¥${totalPOAmountRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`NPR ${totalPOAmountNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <StatCard label="Paid (Dr)" value={`¥${totalPaidRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`NPR ${totalPaidNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <StatCard
              label="Balance Payable"
              value={`¥${r2(totalPOAmountRMB - totalPaidRMB).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub={`NPR ${r2(totalPOAmountNPR - totalPaidNPR).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </div>
          <LedgerTable rows={mode === "summary" ? totalSummaryRows : totalDetailRows} emptyLabel="No transactions recorded yet." />
        </div>
      )}

      {ledger === "due" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Due (Cr)" value={`¥${totalDueRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`NPR ${totalDueNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <StatCard
              label="Total Paid (Dr)"
              value={`¥${r2(po.paidAdvanceRMB + po.paidBalanceRMB).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub={`NPR ${r2(po.paidAdvanceNPR + po.paidBalanceNPR).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </div>
          {mode === "summary" ? (
            <LedgerTable rows={dueSummaryRows} emptyLabel="No estimates available yet." />
          ) : (
            <div className="space-y-4">
              {po.estAdvanceRMB > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">Advance</h4>
                  <LedgerTable rows={dueDetailAdvance} emptyLabel="No advance activity." />
                </div>
              )}
              {po.estBalanceRMB > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">Balance</h4>
                  <LedgerTable rows={dueDetailBalance} emptyLabel="No balance activity." />
                </div>
              )}
              {po.estAdvanceRMB <= 0 && po.estBalanceRMB <= 0 && (
                <div className="bg-white border rounded p-6 text-center text-gray-400 text-sm">No estimates available yet.</div>
              )}
            </div>
          )}

          {notYetDueRows.length > 0 && (
            <div className="bg-white border rounded p-3">
              <button
                type="button"
                onClick={() => setShowNotYetDue((v) => !v)}
                className="w-full flex items-center justify-between text-sm"
              >
                <span className="text-gray-600">
                  Not Yet Due: <span className="font-medium text-gray-800">¥{notYetDueRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>{" "}
                  <span className="text-gray-400">/ NPR {notYetDueNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </span>
                <span className="text-gray-400">{showNotYetDue ? "▲ Hide" : "▼ Show details"}</span>
              </button>
              {showNotYetDue && (
                <div className="mt-3 space-y-1">
                  {notYetDueRows.map((r) => (
                    <div key={r.key} className="flex items-center justify-between text-sm border-t pt-2">
                      <span>{r.particular}</span>
                      <span className="text-gray-500">Due: {fmtDate(r.dueDate)}</span>
                      <span>
                        {`¥${r2(r.cr - r.dr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}{" "}
                        <span className="text-gray-400">/ NPR {r2(r.crNPR - r.drNPR).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ po, onRefresh }: { po: PO; onRefresh: () => Promise<void> }) {
  const latestRate = [...po.payments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0]?.exchangeRate;
  const emptyForm = () => ({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentType: "ADVANCE",
    amountRMB: "",
    exchangeRate: latestRate ? String(latestRate) : "",
    notes: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formFiles, setFormFiles] = useState<File[]>([]);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const fmtRMB = (n: number) => `¥${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const advanceCarriedRMB = r2(Math.max(po.paidAdvanceRMB - po.estAdvanceRMB, 0));
  const effectivePaidBalanceRMB = po.paidBalanceRMB + advanceCarriedRMB;

  // Work out what is still due as if the payment being edited didn't exist. An
  // advance beyond its estimate counts toward the balance (same rule as the server).
  const others = po.payments.filter((p) => p.id !== editingId);
  const sumType = (t: string) => others.filter((p) => p.paymentType === t).reduce((s, p) => s + p.amountRMB, 0);
  const advRaw = sumType("ADVANCE");
  const balRaw = sumType("BALANCE");
  const carry = Math.max(advRaw - po.estAdvanceRMB, 0);
  const advPaid = advRaw - carry;
  const balPaid = balRaw + carry;
  const amount = parseFloat(form.amountRMB) || 0;

  const totalPOAmountRMB = po.piAmountRMB + po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB;
  const othersPaidRMB = others.reduce((s, p) => s + p.amountRMB, 0);
  const wouldTotalRMB = r2(othersPaidRMB + amount);
  const overTotalRMB = r2(Math.max(wouldTotalRMB - totalPOAmountRMB, 0));
  const blockedByTotal = totalPOAmountRMB > 0 && amount > 0 && overTotalRMB > 0;

  let info: { label: string; est: number; paid: number; remaining: number; carriedIn: number } | null = null;
  const notes: string[] = [];
  if (form.paymentType === "ADVANCE" && po.estAdvanceRMB > 0) {
    const remaining = r2(Math.max(po.estAdvanceRMB - advPaid, 0));
    info = { label: "Advance", est: po.estAdvanceRMB, paid: r2(advPaid), remaining, carriedIn: 0 };
    const excess = r2(Math.max(amount - remaining, 0));
    if (amount > 0 && excess > 0) {
      notes.push(`${fmtRMB(excess)} is more than the remaining advance and will be adjusted against the balance.`);
      const balOver = r2(Math.max(balPaid + excess - po.estBalanceRMB, 0));
      if (po.estBalanceRMB > 0 && balOver > 0) notes.push(`That also exceeds the balance due by ${fmtRMB(balOver)}.`);
    }
  } else if (form.paymentType === "BALANCE" && po.estBalanceRMB > 0) {
    const remaining = r2(Math.max(po.estBalanceRMB - balPaid, 0));
    info = { label: "Balance", est: po.estBalanceRMB, paid: r2(balPaid), remaining, carriedIn: r2(carry) };
    const over = r2(Math.max(amount - remaining, 0));
    if (amount > 0 && over > 0) notes.push(`${fmtRMB(over)} is more than the remaining balance (${fmtRMB(remaining)}).`);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setFormFiles([]);
  }

  function startEdit(p: Payment) {
    setEditingId(p.id);
    setForm({
      paymentDate: p.paymentDate.slice(0, 10),
      paymentType: p.paymentType,
      amountRMB: String(p.amountRMB),
      exchangeRate: String(p.exchangeRate),
      notes: p.notes ?? "",
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (blockedByTotal) {
      setError(
        `This payment would bring total payments to ¥${wouldTotalRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, exceeding the PO total of ¥${totalPOAmountRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} by ¥${overTotalRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Reduce the amount before saving.`
      );
      return;
    }
    if (notes.length > 0 && !confirm(`${notes.join("\n")}\n\nSave this payment anyway?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editingId ? `/api/purchase-orders/${po.id}/payments/${editingId}` : `/api/purchase-orders/${po.id}/payments`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save payment");
      }
      const saved = await res.json();
      const paymentId = editingId ?? saved.id;
      for (const file of formFiles) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/purchase-orders/${po.id}/payments/${paymentId}/advice`, { method: "POST", body: fd });
      }
      closeForm();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(paymentId: string) {
    if (!confirm("Delete this payment?")) return;
    await fetch(`/api/purchase-orders/${po.id}/payments/${paymentId}`, { method: "DELETE" });
    if (editingId === paymentId) closeForm();
    await onRefresh();
  }

  async function handleAdviceUpload(paymentId: string, file: File) {
    setUploadingFor(paymentId);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/purchase-orders/${po.id}/payments/${paymentId}/advice`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Upload failed");
      }
      await onRefresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFor(null);
    }
  }

  async function handleAdviceDelete(paymentId: string, adviceId: string) {
    if (!confirm("Remove this payment advice?")) return;
    await fetch(`/api/purchase-orders/${po.id}/payments/${paymentId}/advice?adviceId=${adviceId}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
          className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700"
        >
          {showForm ? "Cancel" : "+ Record Payment"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white border rounded p-4 grid grid-cols-3 gap-3">
          {editingId && <div className="col-span-3 text-sm font-medium">Editing payment</div>}
          <input type="date" className="input" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} required />
          <select className="input" value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })}>
            <option value="ADVANCE">Advance</option>
            <option value="BALANCE">Balance</option>
            <option value="CUSTOM_DUTY">Custom Duty</option>
            <option value="OTHER">Other</option>
          </select>
          <input type="number" step="0.01" min="0.01" className="input" placeholder="Amount RMB" value={form.amountRMB} onChange={(e) => setForm({ ...form, amountRMB: e.target.value })} required />
          <input type="number" step="0.01" className="input" placeholder="Exchange Rate" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} required />
          <input className="input col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="col-span-3">
            <label className="block text-xs text-gray-500 mb-1">Payment advice / evidence (photos or PDF)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              className="text-sm"
              onChange={(e) => setFormFiles(Array.from(e.target.files ?? []))}
            />
            {formFiles.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {formFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded px-1.5 py-0.5">
                    {f.name}
                    <button type="button" onClick={() => setFormFiles(formFiles.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {info && (
            <div className="col-span-3 text-xs text-gray-500">
              {info.label}: estimated {fmtRMB(info.est)}, paid {fmtRMB(info.paid)}
              {info.carriedIn > 0 && ` (includes ${fmtRMB(info.carriedIn)} adjusted from the advance)`},{" "}
              <span className="font-medium text-gray-700">remaining {fmtRMB(info.remaining)}</span>
              {notes.length > 0 && (
                <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
                  {notes.join(" ")} {blockedByTotal ? "" : "You can still save it."}
                </div>
              )}
            </div>
          )}
          {blockedByTotal && (
            <div className="col-span-3 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">
              This payment would bring total payments to {fmtRMB(wouldTotalRMB)}, exceeding the PO total of{" "}
              {fmtRMB(totalPOAmountRMB)} by {fmtRMB(overTotalRMB)}.
            </div>
          )}
          {error && <div className="col-span-3 text-sm text-red-600">{error}</div>}
          <div className="col-span-3">
            <button type="submit" disabled={saving || blockedByTotal} className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Save Changes" : "Record Payment"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type <span className="text-red-600">*</span></th>
              <th className="px-3 py-2">RMB</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">NPR</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2">Evidence</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {po.payments.map((p) => {
              // For advance payments, compute how much of this payment is reclassified as balance
              let carriedNote: string | null = null;
              if (p.paymentType === "ADVANCE") {
                const advanceBefore = po.payments
                  .filter((x) => x.paymentType === "ADVANCE" && new Date(x.paymentDate) < new Date(p.paymentDate))
                  .reduce((s, x) => s + x.amountRMB, 0);
                const advanceAfter = advanceBefore + p.amountRMB;
                const cap = po.estAdvanceRMB;
                const carried = r2(Math.max(advanceAfter - cap, 0) - Math.max(advanceBefore - cap, 0));
                if (carried > 0) carriedNote = `¥${carried.toLocaleString(undefined, { maximumFractionDigits: 2 })} adjusted to balance`;
              }
              return (
              <tr key={p.id} className={`border-t ${editingId === p.id ? "bg-amber-50" : ""}`}>
                <td className="px-3 py-2">{fmtDate(p.paymentDate)}</td>
                <td className="px-3 py-2">{p.paymentType}</td>
                <td className="px-3 py-2 text-right tabular-nums">¥{p.amountRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2">{p.exchangeRate}</td>
                <td className="px-3 py-2 text-right tabular-nums">NPR {p.amountNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2">
                  {p.notes && <span>{p.notes}</span>}
                  {carriedNote && <span className="text-gray-400 text-xs block">{carriedNote}</span>}
                  {!p.notes && !carriedNote && "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1 items-center">
                    {(p.advices ?? []).map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded px-1.5 py-0.5">
                        {a.mimeType === "application/pdf" ? (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[100px] truncate" title={a.fileName}>
                            📄 {a.fileName}
                          </a>
                        ) : (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[100px] truncate" title={a.fileName}>
                            🖼 {a.fileName}
                          </a>
                        )}
                        <button onClick={() => handleAdviceDelete(p.id, a.id)} className="text-red-400 hover:text-red-600 ml-0.5" title="Remove">×</button>
                      </span>
                    ))}
                    <label className={`cursor-pointer text-xs text-gray-500 hover:text-gray-800 border rounded px-1.5 py-0.5 ${uploadingFor === p.id ? "opacity-50" : ""}`}>
                      {uploadingFor === p.id ? "Uploading…" : "+ Add"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        disabled={uploadingFor === p.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleAdviceUpload(p.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {uploadError && uploadingFor === null && (
                    <div className="text-xs text-red-600 mt-0.5">{uploadError}</div>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => startEdit(p)} className="text-blue-600 hover:underline text-xs mr-3">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            );})}
            {po.payments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ShipmentLineForm = {
  poItemId: string;
  chineseSku: string;
  specificName: string;
  remaining: number;
  shippedQty: string;
};

function ReceivingEventRow({
  event,
  shipmentId,
  poId,
  onDone,
  shipmentItemId,
  initialCustomRate,
  showCustomRate,
}: {
  event: ReceivingEvent;
  shipmentId: string;
  poId: string;
  onDone: () => void;
  shipmentItemId?: string;
  initialCustomRate?: number | null;
  showCustomRate?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(toInputDate(event.receivedDate));
  const [qty, setQty] = useState(String(event.receivedQty));
  const [notes, setNotes] = useState(event.notes ?? "");
  const [customRate, setCustomRate] = useState(initialCustomRate != null ? String(initialCustomRate) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/purchase-orders/${poId}/shipments/${shipmentId}/receiving-events/${event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receivedDate: date, receivedQty: qty, notes }),
    });
    if (showCustomRate && shipmentItemId) {
      await fetch(`/api/purchase-orders/${poId}/shipments/${shipmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customRates: [{ shipmentItemId, rate: customRate === "" ? null : customRate }] }),
      });
    }
    setSaving(false);
    setEditing(false);
    onDone();
  }

  async function del() {
    if (!confirm("Delete this receiving event?")) return;
    setSaving(true);
    await fetch(`/api/purchase-orders/${poId}/shipments/${shipmentId}/receiving-events/${event.id}`, { method: "DELETE" });
    setSaving(false);
    onDone();
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 group">
        <span>{toInputDate(event.receivedDate)}: {event.receivedQty}{event.notes ? ` (${event.notes})` : ""}</span>
        {!editing && <>
          <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-blue-500 hover:underline ml-1 text-xs">edit</button>
          <button onClick={del} disabled={saving} className="opacity-0 group-hover:opacity-100 text-red-400 hover:underline text-xs">del</button>
        </>}
      </div>
      {editing && (
        <div className="border border-blue-200 rounded-lg bg-blue-50/40 p-3 space-y-2">
          <div className={`grid gap-2 ${showCustomRate ? "grid-cols-[auto_auto_auto_1fr]" : "grid-cols-[auto_1fr]"}`}>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Date</span>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Qty</span>
              <input type="number" min="0" className="input w-20 text-right" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            {showCustomRate && (
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Custom Rate/Unit (NPR)</span>
                <input type="number" min="0" className="input w-28 text-right" placeholder="NPR/unit" value={customRate} onChange={(e) => setCustomRate(e.target.value)} />
              </label>
            )}
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Notes</span>
              <input className="input w-full" placeholder="optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          {showCustomRate && (() => {
            const q = parseInt(qty) || 0;
            const r = parseFloat(customRate) || 0;
            const total = q > 0 && r > 0 ? q * r : null;
            return total != null ? (
              <div className="flex justify-end text-xs text-gray-600">
                <span>Item Custom Total:&nbsp;</span>
                <span className="font-semibold tabular-nums text-gray-900">NPR {total.toLocaleString()}</span>
              </div>
            ) : null;
          })()}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="rounded bg-gray-900 text-white text-xs px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button onClick={() => setEditing(false)} className="rounded border text-xs px-3 py-1.5 text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceivingForm({
  shipment,
  itemById,
  poId,
  onDone,
}: {
  shipment: Shipment;
  itemById: Map<string, Item>;
  poId: string;
  onDone: () => void;
}) {
  const [arrivalDate, setArrivalDate] = useState(toInputDate(shipment.arrivalDate));
  const [notes, setNotes] = useState(shipment.notes ?? "");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [newQtys, setNewQtys] = useState<Record<string, string>>({});
  const [customRates, setCustomRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(shipment.items.map((l) => [l.id, l.actualCustomRateNPR != null ? String(l.actualCustomRateNPR) : ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customsCleared = shipment.status !== "SHIPPED" && shipment.status !== "AT_CUSTOM";

  const remainingFor = (line: ShipmentItem) => line.shippedQty - line.receivedQty;

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    const entries = shipment.items
      .map((line) => ({ poItemId: line.poItemId, receivedQty: parseInt(newQtys[line.poItemId] ?? "") || 0 }))
      .filter((entry) => entry.receivedQty > 0);
    const hasRates = customsCleared && Object.values(customRates).some((r) => r !== "");
    if (entries.length === 0 && !hasRates) {
      setError("Enter a received quantity or custom rate for at least one item.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const ratePayload = customsCleared
        ? shipment.items.map((l) => ({ shipmentItemId: l.id, rate: customRates[l.id] === "" ? null : customRates[l.id] }))
        : undefined;
      const res = await fetch(`/api/purchase-orders/${poId}/shipments/${shipment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrivalDate,
          notes,
          receivingEvents: entries.map((entry) => ({ ...entry, receivedDate: eventDate })),
          ...(ratePayload ? { customRates: ratePayload } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to log receiving event");
      }
      setNewQtys({});
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log receiving event");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkComplete() {
    if (!confirm("Mark this shipment's receiving as complete? Any remaining shortfall will be treated as final.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/shipments/${shipment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivingConfirmed: true }),
      });
      if (!res.ok) throw new Error("Failed to mark receipt completed");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark receipt completed");
    } finally {
      setSaving(false);
    }
  }

  const fullyReceived = shipment.items.every((line) => remainingFor(line) <= 0);
  // Receiving can't start until this shipment has cleared customs (AT_CUSTOM_CLEARANCE).
  const awaitingCustoms = shipment.status === "SHIPPED" || shipment.status === "AT_CUSTOM";

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Arrival Date</span>
          <input type="date" className="input" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Notes</span>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={saving || awaitingCustoms || shipment.receivingConfirmed || fullyReceived}
            className="rounded-md border border-gray-300 text-sm font-medium text-gray-700 px-3 py-2 hover:bg-white disabled:opacity-50 w-full transition-colors"
          >
            {shipment.receivingConfirmed ? "✓ Receipt Marked Complete" : "Mark Receipt Completed"}
          </button>
        </div>
      </div>

      {shipment.status === "SHIPPED" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This shipment hasn&rsquo;t reached Customs yet. Use the PO&rsquo;s &ldquo;Mark: Custom Arrival&rdquo; button to mark it.
        </div>
      )}
      {shipment.status === "AT_CUSTOM" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This shipment is at Customs but hasn&rsquo;t cleared yet. Use the PO&rsquo;s &ldquo;Mark: Custom Clearance&rdquo; button to mark it.
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">Chinese SKU</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium text-right">Shipped</th>
              <th className="px-3 py-2 font-medium text-right">Received So Far</th>
              {customsCleared && <th className="px-3 py-2 font-medium text-right">Custom Rate/Unit (NPR)</th>}
              <th className="px-3 py-2 font-medium">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shipment.items.map((line) => {
              const item = itemById.get(line.poItemId);
              return (
                <tr key={line.id} className="align-top">
                  <td className="px-3 py-2.5 font-mono text-sm text-gray-700">{item?.chineseSku ?? "-"}</td>
                  <td className="px-3 py-2.5 text-gray-700">{item?.specificName ?? "-"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{line.shippedQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 font-semibold">{line.receivedQty}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {line.receivingEvents.length === 0 && "-"}
                    {line.receivingEvents.map((ev) => (
                      <ReceivingEventRow
                        key={ev.id}
                        event={ev}
                        shipmentId={shipment.id}
                        poId={poId}
                        onDone={onDone}
                        shipmentItemId={line.id}
                        initialCustomRate={line.actualCustomRateNPR}
                        showCustomRate={customsCleared}
                      />
                    ))}
                  </td>
                  {customsCleared && (
                    <td className="px-3 py-2.5 text-right">
                      <CustomRateInput
                        shipmentId={shipment.id}
                        poId={poId}
                        shipmentItemId={line.id}
                        value={line.actualCustomRateNPR}
                        onSaved={onDone}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAddEvent} className="border border-gray-200 rounded-lg bg-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-700">Log a New Receiving Event</h4>
          <input
            type="date"
            className="input w-auto"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            disabled={awaitingCustoms}
          />
        </div>
        <div className="space-y-1">
          <div className={`grid gap-2 text-xs font-medium text-gray-400 px-1 ${customsCleared ? "grid-cols-[1fr_auto_auto_auto_auto]" : "grid-cols-[1fr_auto_auto]"}`}>
            <span>SKU</span>
            <span className="text-right w-16">Remaining</span>
            <span className="text-right w-20">Recv Qty</span>
            {customsCleared && <span className="text-right w-28">Custom Rate/Unit</span>}
            {customsCleared && <span className="text-right w-24">Item Total</span>}
          </div>
          {shipment.items.map((line) => {
            const item = itemById.get(line.poItemId);
            const remaining = remainingFor(line);
            const qty = parseInt(newQtys[line.poItemId] ?? "") || 0;
            const rate = parseFloat(customRates[line.id] ?? "") || 0;
            const itemTotal = qty > 0 && rate > 0 ? qty * rate : null;
            return (
              <div key={line.id} className={`grid gap-2 items-center text-xs ${customsCleared ? "grid-cols-[1fr_auto_auto_auto_auto]" : "grid-cols-[1fr_auto_auto]"}`}>
                <span className="font-mono truncate">{item?.chineseSku ?? line.poItemId}</span>
                <span className="text-gray-400 text-right w-16">rem. {remaining}</span>
                <input
                  type="number"
                  min="0"
                  className="input w-20 text-right"
                  placeholder="Qty"
                  disabled={awaitingCustoms}
                  value={newQtys[line.poItemId] ?? ""}
                  onChange={(e) => setNewQtys({ ...newQtys, [line.poItemId]: e.target.value })}
                />
                {customsCleared && (
                  <input
                    type="number"
                    min="0"
                    className="input w-28 text-right"
                    placeholder="NPR/unit"
                    value={customRates[line.id] ?? ""}
                    onChange={(e) => setCustomRates({ ...customRates, [line.id]: e.target.value })}
                  />
                )}
                {customsCleared && (
                  <span className="text-right w-24 tabular-nums text-gray-700">
                    {itemTotal != null ? itemTotal.toLocaleString() : "—"}
                  </span>
                )}
              </div>
            );
          })}
          {customsCleared && (() => {
            const grandTotal = shipment.items.reduce((sum, line) => {
              const qty = parseInt(newQtys[line.poItemId] ?? "") || 0;
              const rate = parseFloat(customRates[line.id] ?? "") || 0;
              return sum + (qty > 0 && rate > 0 ? qty * rate : 0);
            }, 0);
            return grandTotal > 0 ? (
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center text-xs border-t pt-1 mt-1">
                <span className="font-medium text-gray-600">Total Custom (NPR)</span>
                <span className="w-16" />
                <span className="w-20" />
                <span className="w-28" />
                <span className="text-right w-24 tabular-nums font-semibold text-gray-900">{grandTotal.toLocaleString()}</span>
              </div>
            ) : null;
          })()}
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        <button
          type="submit"
          disabled={saving || awaitingCustoms}
          className="rounded-md bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Add Receiving Event"}
        </button>
      </form>
    </div>
  );
}

function CustomPickerModal({
  po,
  onClose,
  onDone,
}: {
  po: PO;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const eligible = po.shipments.filter((s) => s.status === "SHIPPED");
  const [selected, setSelected] = useState<Set<string>>(new Set(eligible.map((s) => s.id)));
  const [actualDate, setActualDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) {
      setError("Select at least one shipment.");
      return;
    }
    // Client-side: customs date must not be before any selected shipment's shipping date
    const selectedShipments = eligible.filter((s) => selected.has(s.id));
    const tooEarly = selectedShipments.filter((s) => actualDate < s.shippingDate.slice(0, 10));
    if (tooEarly.length > 0) {
      const latest = tooEarly.map((s) => s.shippingDate.slice(0, 10)).sort().pop()!;
      setError(`Customs arrival date cannot be before shipping date (${latest})`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/stage/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentIds: Array.from(selected), actualDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update shipments");
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update shipments");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-4 w-full max-w-lg">
        <h3 className="text-sm font-medium mb-1">Which shipments reached Customs?</h3>
        <p className="text-xs text-gray-500 mb-3">
          Different packing lists can clear customs on different days - select the ones to mark now.
        </p>
        <div className="border rounded divide-y max-h-64 overflow-y-auto">
          {eligible.map((s) => (
            <label key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <span className="font-medium">{fmtDate(s.shippingDate)}</span>
              <span className="text-gray-500">{s.shippedQty} units</span>
              <span className="text-gray-400">{s.transportMode}</span>
            </label>
          ))}
          {eligible.length === 0 && (
            <div className="px-3 py-4 text-center text-gray-400 text-xs">No shipments currently at Shipped.</div>
          )}
        </div>
        <label className="block mt-3">
          <span className="block text-xs font-medium text-gray-500 mb-1">{STAGE_DATE_LABELS.CUSTOM}</span>
          <input type="date" className="input" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
        </label>
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm text-gray-600 hover:underline px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || eligible.length === 0}
            className="rounded bg-gray-900 text-white text-sm px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Mark as At Customs"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClearancePickerModal({ po, onClose, onDone }: { po: PO; onClose: () => void; onDone: () => Promise<void> }) {
  const eligible = po.shipments.filter((s) => s.status === "AT_CUSTOM");
  const [selected, setSelected] = useState<Set<string>>(new Set(eligible.map((s) => s.id)));
  const [actualDate, setActualDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function handleConfirm() {
    if (selected.size === 0) { setError("Select at least one shipment."); return; }
    const selectedShipments = eligible.filter((s) => selected.has(s.id));
    const tooEarly = selectedShipments.filter((s) => s.actualCustomArrivalDate && actualDate < s.actualCustomArrivalDate.slice(0, 10));
    if (tooEarly.length > 0) {
      const latest = tooEarly.map((s) => s.actualCustomArrivalDate!.slice(0, 10)).sort().pop()!;
      setError(`Clearance date cannot be before customs arrival date (${latest})`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/stage/custom-clearance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentIds: Array.from(selected), actualDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update shipments");
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update shipments");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-4 w-full max-w-lg">
        <h3 className="text-sm font-medium mb-1">Which shipments cleared Customs?</h3>
        <p className="text-xs text-gray-500 mb-3">Select the shipments that have completed customs clearance.</p>
        <div className="border rounded divide-y max-h-64 overflow-y-auto">
          {eligible.map((s) => (
            <label key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <span className="font-medium">{fmtDate(s.shippingDate)}</span>
              <span className="text-gray-500">{s.shippedQty} units</span>
              <span className="text-gray-400">{s.transportMode}</span>
              {s.actualCustomArrivalDate && <span className="text-xs text-gray-400">arrived {fmtDate(s.actualCustomArrivalDate)}</span>}
            </label>
          ))}
          {eligible.length === 0 && <div className="px-3 py-4 text-center text-gray-400 text-xs">No shipments at Custom Arrival.</div>}
        </div>
        <label className="block mt-3">
          <span className="block text-xs font-medium text-gray-500 mb-1">Customs Clearance Date</span>
          <input type="date" className="input" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
        </label>
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm text-gray-600 hover:underline px-3 py-1.5">Cancel</button>
          <button onClick={handleConfirm} disabled={saving || eligible.length === 0} className="rounded bg-gray-900 text-white text-sm px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50">
            {saving ? "Saving..." : "Mark as Cleared"}
          </button>
        </div>
      </div>
    </div>
  );
}

type HistoryRow = {
  key: string;
  stage: Stage;
  label: string;
  dateLabel: string | null;
  shipmentLabel: string | null;
  actualDate: string | null;
  estimateDate: string | null;
  eventId: string | null;
};

function varianceLabel(actual: string | null, estimate: string | null) {
  if (!actual) return null;
  if (!estimate) return null;
  const days = Math.round((new Date(actual).getTime() - new Date(estimate).getTime()) / 86400000);
  if (days === 0) return { text: "On time", tone: "text-green-700 bg-green-50" };
  if (days > 0) return { text: `${days}d late`, tone: "text-red-700 bg-red-50" };
  return { text: `${-days}d early`, tone: "text-blue-700 bg-blue-50" };
}

// Every stage actually reached, PO-level and per-shipment, with its actual
// date compared against whichever existing estimate field maps to that
// stage (see STAGE_ESTIMATE_FIELD in poStages.ts) - most manual stages have
// no such field yet and show the actual date alone. This is the full
// history: one row per StageEvent, oldest first.
function HistoryTab({ po, onRefresh }: { po: PO; onRefresh: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const mfgType = po.items[0]?.mfgType ?? null;
  const stages = stagesFor(mfgType);
  const shipmentIndexById = new Map(po.shipments.map((s, i) => [s.id, i + 1]));

  const recordedStages = new Set(po.stageEvents.filter((e) => !e.shipmentId).map((e) => e.stage));
  const currentStageIdx = stages.indexOf(po.stage as Stage);

  const eventRows: HistoryRow[] = po.stageEvents.map((ev) => {
    const stage = ev.stage as Stage;
    const estField = STAGE_ESTIMATE_FIELD[stage];
    const estimateDate = ev.shipmentId ? null : estField ? (po as unknown as Record<string, string | null>)[estField] : null;
    return {
      key: ev.id,
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      dateLabel: STAGE_DATE_LABELS[stage] ?? null,
      shipmentLabel: ev.shipmentId ? `Shipment #${shipmentIndexById.get(ev.shipmentId) ?? "?"}` : null,
      actualDate: ev.actualDate,
      estimateDate,
      eventId: ev.id,
    };
  });

  // Synthesize placeholder rows for PO-level stages the PO has clearly passed
  // through (up to and including its current stage) but that have no recorded event.
  const syntheticRows: HistoryRow[] = stages
    .slice(0, currentStageIdx + 1)
    .filter((s) => !recordedStages.has(s))
    .map((stage) => {
      const estField = STAGE_ESTIMATE_FIELD[stage];
      const estimateDate = estField ? (po as unknown as Record<string, string | null>)[estField] : null;
      return {
        key: `synthetic-${stage}`,
        stage,
        label: STAGE_LABELS[stage] ?? stage,
        dateLabel: STAGE_DATE_LABELS[stage] ?? null,
        shipmentLabel: null,
        actualDate: null,
        estimateDate,
        eventId: null,
      };
    });

  const rows: HistoryRow[] = [...eventRows, ...syntheticRows].sort((a, b) => {
    // Sort by stage pipeline order first, then by actual date within same stage
    const ai = stages.indexOf(a.stage);
    const bi = stages.indexOf(b.stage);
    if (ai !== bi) return ai - bi;
    if (!a.actualDate) return -1;
    if (!b.actualDate) return 1;
    return new Date(a.actualDate).getTime() - new Date(b.actualDate).getTime();
  });

  async function handleSaveDate(eventId: string) {
    if (!editDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/stage-events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualDate: editDate }),
      });
      if (!res.ok) throw new Error("Failed to update date");
      setEditingId(null);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Every stage this PO (and its shipments) has passed through, with the actual date it happened. Where an
        estimate exists, the variance shows how many days early or late it landed.
      </p>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Scope</th>
              <th className="px-4 py-2 font-medium">Actual Date</th>
              <th className="px-4 py-2 font-medium">Estimated</th>
              <th className="px-4 py-2 font-medium">Variance</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const variance = row.actualDate ? varianceLabel(row.actualDate, row.estimateDate) : null;
              const isEditing = row.eventId && editingId === row.eventId;
              const isSynthetic = row.eventId === null;
              return (
                <tr key={row.key} className={isSynthetic ? "opacity-50" : ""}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{row.label}</div>
                    {row.dateLabel && <div className="text-xs text-gray-400">{row.dateLabel}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{row.shipmentLabel ?? "PO"}</td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          className="input w-auto"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                        <button
                          onClick={() => handleSaveDate(row.eventId!)}
                          disabled={saving}
                          className="text-xs font-medium text-gray-900 hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">
                          Cancel
                        </button>
                      </div>
                    ) : isSynthetic ? (
                      <span className="text-gray-300 italic text-xs">date unknown</span>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(row.eventId);
                          setEditDate(toInputDate(row.actualDate));
                        }}
                        className="text-gray-700 hover:underline"
                      >
                        {fmtDate(row.actualDate)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{row.estimateDate ? fmtDate(row.estimateDate) : "-"}</td>
                  <td className="px-4 py-2.5">
                    {variance ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${variance.tone}`}>
                        {variance.text}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5"></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No stages reached yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400">
        Full pipeline: {stages.map((s) => STAGE_LABELS[s]).join(" → ")}
      </div>

      {po.dateRevisions.length > 0 && <DateRevisionsPanel revisions={po.dateRevisions} />}
    </div>
  );
}

const SHIPMENT_STATUS_STYLES: Record<string, { dot: string; edge: string; badge: string; label: string }> = {
  SHIPPED: { dot: "bg-indigo-500", edge: "border-l-indigo-500", badge: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200", label: "Shipped" },
  AT_CUSTOM: { dot: "bg-orange-500", edge: "border-l-orange-500", badge: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200", label: "At Custom Arrival" },
  AT_CUSTOM_CLEARANCE: { dot: "bg-amber-500", edge: "border-l-amber-500", badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", label: "Custom Clearance" },
  RECEIVED: { dot: "bg-green-500", edge: "border-l-green-500", badge: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200", label: "Received" },
};

function ReceivingModal({
  po,
  onClose,
  onDone,
}: {
  po: PO;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const itemById = new Map(po.items.map((i) => [i.id, i]));
  // Only show shipments that still need receiving — exclude fully confirmed ones
  const selectable = po.shipments.filter((s) => {
    if (s.status === "AT_CUSTOM_CLEARANCE") return true;
    if (s.status === "RECEIVED" && !s.receivingConfirmed) {
      return !s.items.every((line) => line.receivedQty >= line.shippedQty);
    }
    return false;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectable.find((s) => s.id === selectedId) ?? null;

  const shipmentIndex = (id: string) => po.shipments.findIndex((s) => s.id === id) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-10">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          {selected ? (
            <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              <span>←</span> Back to shipment list
            </button>
          ) : (
            <h2 className="text-base font-semibold text-gray-900">Select Shipment to Update</h2>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {!selected ? (
          <div className="divide-y divide-gray-100">
            {selectable.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No shipments pending receiving.</div>
            )}
            {selectable.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Shipment #{shipmentIndex(s.id)} — {fmtDate(s.shippingDate)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Shipped {s.shippedQty} · Received {s.receivedQty} · Remaining {s.shippedQty - s.receivedQty}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SHIPMENT_STATUS_STYLES[s.status]?.badge ?? ""}`}>
                    {SHIPMENT_STATUS_STYLES[s.status]?.label ?? s.status}
                  </span>
                  <span className="text-gray-400">›</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-gray-700">
                Shipment #{shipmentIndex(selected.id)} — {fmtDate(selected.shippingDate)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SHIPMENT_STATUS_STYLES[selected.status]?.badge ?? ""}`}>
                {SHIPMENT_STATUS_STYLES[selected.status]?.label ?? selected.status}
              </span>
            </div>
            <ReceivingForm shipment={selected} itemById={itemById} poId={po.id} onDone={onDone} />
          </div>
        )}
      </div>
    </div>
  );
}

function DateRevisionsPanel({ revisions }: { revisions: DateRevision[] }) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Group by label, preserving insertion order (most-recent revisions first per group)
  const groups: { label: string; latest: DateRevision; history: DateRevision[] }[] = [];
  const seen = new Map<string, typeof groups[0]>();
  for (const r of revisions) {
    if (!seen.has(r.label)) {
      const g = { label: r.label, latest: r, history: [] as DateRevision[] };
      groups.push(g);
      seen.set(r.label, g);
    } else {
      seen.get(r.label)!.history.push(r);
    }
  }

  function toggle(label: string) {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">Estimate Date Revisions</h3>
      <div className="bg-white rounded border divide-y divide-gray-100 text-sm">
        {groups.map(({ label, latest, history }) => {
          const expanded = expandedFields.has(label);
          const total = 1 + history.length;
          return (
            <div key={label}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-40 font-medium text-gray-800 shrink-0">{label}</div>
                <div className="flex-1 text-gray-500 truncate">{latest.reason}</div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-gray-400 tabular-nums">
                    {latest.fromDate ? fmtDate(latest.fromDate) : <span className="italic text-gray-300">none</span>}
                    {" → "}
                    <span className="text-gray-800 font-medium">{latest.toDate ? fmtDate(latest.toDate) : "—"}</span>
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(latest.createdAt)}</span>
                  {total > 1 && (
                    <button
                      onClick={() => toggle(label)}
                      className="text-xs text-blue-600 hover:text-blue-800 transition-colors w-16 text-right"
                    >
                      {expanded ? "Hide" : `+${history.length} more`}
                    </button>
                  )}
                </div>
              </div>
              {expanded && history.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t border-gray-100">
                  <div className="w-40 shrink-0" />
                  <div className="flex-1 text-gray-400 truncate text-xs">{r.reason}</div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-400 tabular-nums text-xs">
                      {r.fromDate ? fmtDate(r.fromDate) : <span className="italic">none</span>}
                      {" → "}
                      <span className="text-gray-600">{r.toDate ? fmtDate(r.toDate) : "—"}</span>
                    </span>
                    <span className="text-xs text-gray-400 w-16 text-right">{fmtDate(r.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomRateInput({ shipmentId, poId, shipmentItemId, value, onSaved }: { shipmentId: string; poId: string; shipmentItemId: string; value: number | null; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        className="font-medium text-gray-700 hover:text-blue-600 underline-offset-2 hover:underline tabular-nums"
        onClick={() => { setDraft(value != null ? String(value) : ""); setEditing(true); }}
      >
        {value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-gray-400 italic text-xs">enter</span>}
      </button>
    );
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/purchase-orders/${poId}/shipments/${shipmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customRates: [{ shipmentItemId, rate: draft === "" ? null : draft }] }),
    });
    setSaving(false);
    setEditing(false);
    await onSaved();
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        type="number"
        className="border rounded px-1.5 py-0.5 text-xs w-24 text-right"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="text-xs text-blue-600 hover:underline">{saving ? "…" : "Save"}</button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:underline">✕</button>
    </span>
  );
}

function ShippingTab({ po, onRefresh, customPoints }: { po: PO; onRefresh: () => Promise<void>; customPoints: string[] }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shippingDate: new Date().toISOString().slice(0, 10),
    transportMode: "ROAD",
    customPoint: "",
    notes: "",
  });
  const [lines, setLines] = useState<ShipmentLineForm[]>([]);
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  function alreadyShipped(itemId: string) {
    return po.shipments.reduce(
      (s, sh) => s + sh.items.filter((i) => i.poItemId === itemId).reduce((s2, i) => s2 + i.shippedQty, 0),
      0
    );
  }

  function resetForm() {
    setForm({
      shippingDate: new Date().toISOString().slice(0, 10),
      transportMode: "ROAD",
      customPoint: "",
      notes: "",
    });
    setLines([]);
    setFormFiles([]);
    setError(null);
  }

  // Pulls every PO item with qty remaining (ordered minus already shipped)
  // into the form as an editable, removable row, instead of typing each
  // Chinese SKU and quantity by hand.
  function pullFromPO() {
    const pulled: ShipmentLineForm[] = po.items
      .map((item) => {
        const remaining = item.unitsOrdered - alreadyShipped(item.id);
        return {
          poItemId: item.id,
          chineseSku: item.chineseSku ?? "-",
          specificName: item.specificName ?? "-",
          remaining,
          shippedQty: remaining > 0 ? String(remaining) : "",
        };
      })
      .filter((l) => l.remaining > 0);
    setLines(pulled);
  }

  function updateLine(poItemId: string, patch: Partial<ShipmentLineForm>) {
    setLines((prev) => prev.map((l) => (l.poItemId === poItemId ? { ...l, ...patch } : l)));
  }

  function removeLine(poItemId: string) {
    setLines((prev) => prev.filter((l) => l.poItemId !== poItemId));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validLines = lines.filter((l) => (parseInt(l.shippedQty) || 0) > 0);
    if (validLines.length === 0) {
      setError("Add at least one item with a shipped quantity.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: validLines.map((l) => ({
            poItemId: l.poItemId,
            shippedQty: l.shippedQty,
            receivedQty: "0",
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to add shipment");
      }
      const saved = await res.json();
      for (const file of formFiles) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/purchase-orders/${po.id}/shipments/${saved.id}/attachments`, { method: "POST", body: fd });
      }
      resetForm();
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add shipment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(shipmentId: string) {
    if (!confirm("Delete this shipment?")) return;
    await fetch(`/api/purchase-orders/${po.id}/shipments/${shipmentId}`, { method: "DELETE" });
    await onRefresh();
  }

  async function handleAttachmentUpload(shipmentId: string, file: File) {
    setUploadingFor(shipmentId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/purchase-orders/${po.id}/shipments/${shipmentId}/attachments`, { method: "POST", body: fd });
      await onRefresh();
    } finally {
      setUploadingFor(null);
    }
  }

  async function handleAttachmentDelete(shipmentId: string, attachmentId: string) {
    if (!confirm("Remove this attachment?")) return;
    await fetch(`/api/purchase-orders/${po.id}/shipments/${shipmentId}/attachments?attachmentId=${attachmentId}`, { method: "DELETE" });
    await onRefresh();
  }

  async function handleRollbackShipment(shipmentId: string, toLabel: string) {
    if (!confirm(`Roll this shipment back to ${toLabel}? Any receiving logged for it will be cleared.`)) return;
    const res = await fetch(`/api/purchase-orders/${po.id}/shipments/${shipmentId}/stage`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Failed to roll back shipment");
      return;
    }
    await onRefresh();
  }

  const [receivingId, setReceivingId] = useState<string | null>(null);

  const itemById = new Map(po.items.map((i) => [i.id, i]));

  const totalShipped = po.shipments.reduce((s, sh) => s + sh.shippedQty, 0);
  const totalReceived = po.shipments.reduce((s, sh) => s + (sh.receivedQty ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5 text-sm">
          <div>
            <span className="text-gray-400">Shipments</span>{" "}
            <span className="font-semibold text-gray-900">{po.shipments.length}</span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <span className="text-gray-400">Shipped</span>{" "}
            <span className="font-semibold text-gray-900 tabular-nums">
              {totalShipped}
              <span className="text-gray-400 font-normal"> / {po.unitsOrdered}</span>
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <span className="text-gray-400">Received</span>{" "}
            <span className="font-semibold text-gray-900 tabular-nums">
              {totalReceived}
              <span className="text-gray-400 font-normal"> / {po.unitsOrdered}</span>
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) resetForm();
          }}
          className="rounded-md bg-gray-900 text-white text-sm font-medium px-3.5 py-2 hover:bg-gray-700 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Shipment"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">New Shipment</h3>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Shipping Date</span>
              <input type="date" className="input" value={form.shippingDate} onChange={(e) => setForm({ ...form, shippingDate: e.target.value })} required />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Transport Mode</span>
              <select className="input" value={form.transportMode} onChange={(e) => setForm({ ...form, transportMode: e.target.value })}>
                <option value="ROAD">Road</option>
                <option value="AIRWAY">Airway</option>
                <option value="SEA">Sea / Waterway</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Custom Point</span>
              <select className="input" value={form.customPoint} onChange={(e) => setForm({ ...form, customPoint: e.target.value })}>
                <option value="">— None —</option>
                {customPoints.map((cp) => <option key={cp} value={cp}>{cp}</option>)}
              </select>
            </label>
            <label className="block col-span-2">
              <span className="block text-xs font-medium text-gray-500 mb-1">Notes</span>
              <input className="input" placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {form.shippingDate && (() => {
              const base = new Date(form.shippingDate);
              const transit = form.transportMode === "AIRWAY" ? 15 : form.transportMode === "SEA" ? 50 : 30;
              const addD = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
              const fmt = (d: Date) => d.toISOString().slice(0, 10);
              const customArrival = addD(base, transit);
              const customClearance = addD(customArrival, 5);
              const arrival = addD(customClearance, 5);
              return (
                <div className="col-span-3 flex gap-5 text-xs bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-blue-700">
                  <span><span className="text-blue-400">Est. Custom Arrival</span> <span className="font-medium">{fmt(customArrival)}</span></span>
                  <span><span className="text-blue-400">Est. Custom Clearance</span> <span className="font-medium">{fmt(customClearance)}</span></span>
                  <span><span className="text-blue-400">Est. Arrival</span> <span className="font-medium">{fmt(arrival)}</span></span>
                </div>
              );
            })()}
            <div className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Packing List / Documents</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="text-sm"
                onChange={(e) => setFormFiles(Array.from(e.target.files ?? []))}
              />
              {formFiles.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {formFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded px-1.5 py-0.5">
                      {f.name}
                      <button type="button" onClick={() => setFormFiles(formFiles.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <h4 className="text-sm font-semibold text-gray-900">Packing List</h4>
            <button type="button" onClick={pullFromPO} className="text-xs font-medium rounded-md border border-gray-300 text-gray-700 px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
              ⇩ Pull Remaining Items from PO
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 font-medium">Chinese SKU</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium text-right">Remaining</th>
                  <th className="px-3 py-2 font-medium">Shipped Qty</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => (
                  <tr key={l.poItemId}>
                    <td className="px-3 py-2.5 font-mono text-sm text-gray-700">{l.chineseSku}</td>
                    <td className="px-3 py-2.5 text-gray-700">{l.specificName}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-right tabular-nums">{l.remaining}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={l.shippedQty}
                        onChange={(e) => updateLine(l.poItemId, { shippedQty: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeLine(l.poItemId)} className="text-red-600 hover:underline text-xs font-medium">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">
                      No items added. Use &ldquo;Pull Remaining Items from PO&rdquo; or add them manually.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
          <button type="submit" disabled={saving} className="rounded-md bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Add Shipment"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {po.shipments.map((s, idx) => (
          <ShipmentCard
            key={s.id}
            shipment={s}
            index={idx}
            itemById={itemById}
            isReceiving={receivingId === s.id}
            onToggleReceiving={() => setReceivingId(receivingId === s.id ? null : s.id)}
            onDelete={() => handleDelete(s.id)}
            onRollback={() => handleRollbackShipment(s.id, s.status === "RECEIVED" ? "At Custom" : "Shipped")}
            poId={po.id}
            onReceivingDone={() => { setReceivingId(null); onRefresh(); }}
            onAttachmentUpload={(file) => handleAttachmentUpload(s.id, file)}
            onAttachmentDelete={(attId) => handleAttachmentDelete(s.id, attId)}
            uploadingAttachment={uploadingFor === s.id}
            onRefresh={onRefresh}
          />
        ))}
        {po.shipments.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-500 text-sm">No shipments recorded yet.</p>
            <p className="text-gray-400 text-xs mt-1">Add one above once goods leave the vendor.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// A single shipment/packing-list card. A left accent stripe carries the
// stage color so the list reads as a scannable timeline rather than a wall
// of identical rows - most-recent-first order is unnecessary since these
// are shown in shipping order already (see the map in ShippingTab).
function ShipmentCard({
  shipment: s,
  index,
  itemById,
  isReceiving,
  onToggleReceiving,
  onDelete,
  onRollback,
  poId,
  onReceivingDone,
  onAttachmentUpload,
  onAttachmentDelete,
  uploadingAttachment,
  onRefresh,
}: {
  shipment: Shipment;
  index: number;
  itemById: Map<string, Item>;
  isReceiving: boolean;
  onToggleReceiving: () => void;
  onDelete: () => void;
  onRollback: () => void;
  poId: string;
  onReceivingDone: () => void;
  onAttachmentUpload: (file: File) => void;
  onAttachmentDelete: (attId: string) => void;
  uploadingAttachment: boolean;
  onRefresh: () => Promise<void>;
}) {
  const style = SHIPMENT_STATUS_STYLES[s.status] ?? SHIPMENT_STATUS_STYLES.SHIPPED;
  const totalReceived = s.items.reduce((sum, line) => sum + line.receivedQty, 0);
  const isShort = s.status === "RECEIVED" && totalReceived < s.shippedQty;
  const [showDetails, setShowDetails] = useState(false);
  const rollbackLabel = s.status === "RECEIVED" ? "Custom Clearance" : s.status === "AT_CUSTOM_CLEARANCE" ? "At Custom Arrival" : s.status === "AT_CUSTOM" ? "Shipped" : null;
  const [editingRemarks, setEditingRemarks] = useState(false);
  const [remarksValue, setRemarksValue] = useState(s.notes ?? "");
  const [savingRemarks, setSavingRemarks] = useState(false);

  async function saveRemarks() {
    setSavingRemarks(true);
    await fetch(`/api/purchase-orders/${poId}/shipments/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: remarksValue }),
    });
    setSavingRemarks(false);
    setEditingRemarks(false);
    await onRefresh();
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm border-l-4 ${style.edge}`}>
      <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-400 tabular-nums">#{index + 1}</span>
          <span className="font-semibold text-gray-900 text-sm">{fmtDate(s.shippingDate)}</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label}
            {isShort && <span className="opacity-70">(short)</span>}
          </span>
          {s.receivingConfirmed && (
            <span className="text-xs text-gray-400 italic">confirmed complete</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          {rollbackLabel && (
            <button
              onClick={onRollback}
              title={`Roll back to ${rollbackLabel}`}
              className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              ← Undo to {rollbackLabel}
            </button>
          )}
          {(s.status === "AT_CUSTOM_CLEARANCE" || s.status === "RECEIVED") && (
            <button onClick={onToggleReceiving} className="font-medium text-gray-600 hover:text-gray-900 transition-colors">
              {isReceiving ? "Close" : "Update Receiving"}
            </button>
          )}
          <button onClick={onDelete} className="font-medium text-red-500 hover:text-red-700 transition-colors">
            Delete
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center gap-5 text-sm text-gray-500 flex-wrap">
        <span>{s.transportMode === "AIRWAY" ? "✈ Airway" : s.transportMode === "SEA" ? "🚢 Sea" : "🚚 Road"}</span>
        <span className="tabular-nums">
          <span className="text-gray-400">Shipped</span> <span className="font-medium text-gray-700">{s.shippedQty}</span>
        </span>
        <span className="tabular-nums">
          <span className="text-gray-400">Received</span>{" "}
          <span className="font-medium text-gray-700">{totalReceived || "-"}</span>
        </span>
        <span>
          <span className="text-gray-400">Arrival</span> {fmtDate(s.arrivalDate)}
        </span>
        {s.customPoint && (
          <span>
            <span className="text-gray-400">Custom</span> <span className="font-medium text-gray-700">{s.customPoint}</span>
          </span>
        )}
        {editingRemarks ? (
          <span className="flex items-center gap-1.5">
            <input
              autoFocus
              className="border rounded px-2 py-0.5 text-xs w-56"
              value={remarksValue}
              onChange={(e) => setRemarksValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveRemarks(); if (e.key === "Escape") setEditingRemarks(false); }}
              placeholder="Add remarks…"
            />
            <button onClick={saveRemarks} disabled={savingRemarks} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
              {savingRemarks ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setEditingRemarks(false); setRemarksValue(s.notes ?? ""); }} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            {s.notes
              ? <span className="text-gray-400 italic truncate max-w-xs">&ldquo;{s.notes}&rdquo;</span>
              : <span className="text-gray-300 text-xs">no remarks</span>
            }
            <button onClick={() => { setRemarksValue(s.notes ?? ""); setEditingRemarks(true); }} className="text-gray-300 hover:text-gray-600 text-xs ml-0.5" title="Edit remarks">✎</button>
          </span>
        )}
      </div>

      {/* Per-shipment estimated / actual milestone dates */}
      <div className="px-4 pb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
        <span>
          <span className="text-gray-400">Est. Custom Arrival</span>{" "}
          <span className={s.actualCustomArrivalDate ? "line-through text-gray-300" : "font-medium text-gray-700"}>{fmtDate(s.estCustomArrivalDate)}</span>
          {s.actualCustomArrivalDate && <span className="ml-1 font-medium text-green-700">{fmtDate(s.actualCustomArrivalDate)} ✓</span>}
        </span>
        <span>
          <span className="text-gray-400">Est. Custom Clearance</span>{" "}
          <span className={s.actualCustomDate ? "line-through text-gray-300" : "font-medium text-gray-700"}>{fmtDate(s.estCustomClearanceDate)}</span>
          {s.actualCustomDate && <span className="ml-1 font-medium text-green-700">{fmtDate(s.actualCustomDate)} ✓</span>}
        </span>
        <span>
          <span className="text-gray-400">Est. Arrival</span>{" "}
          <span className="font-medium text-gray-700">{fmtDate(s.estArrivalDate)}</span>
        </span>
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-1 items-center">
        <div className="flex flex-wrap gap-1 items-center ml-auto">
          {(s.attachments ?? []).map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[120px] truncate" title={a.fileName}>
                {a.mimeType === "application/pdf" ? "📄" : "🖼"} {a.fileName}
              </a>
              <button onClick={() => onAttachmentDelete(a.id)} className="text-red-400 hover:text-red-600 ml-0.5" title="Remove">×</button>
            </span>
          ))}
          <label className={`cursor-pointer text-xs text-gray-500 hover:text-gray-800 border rounded px-1.5 py-0.5 ${uploadingAttachment ? "opacity-50" : ""}`}>
            {uploadingAttachment ? "Uploading…" : "+ Packing List"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              disabled={uploadingAttachment}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttachmentUpload(f); e.target.value = ""; }}
            />
          </label>
        </div>
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          {showDetails ? "Hide" : "Show"} item details ({s.items.length})
        </button>
      </div>

      {showDetails && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="min-w-full text-base">
            <thead className="text-left text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 font-medium">Chinese SKU</th>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium text-right">Shipped</th>
                <th className="px-4 py-2 font-medium text-right">Received</th>
                {s.actualCustomDate && <th className="px-4 py-2 font-medium text-right">Custom Rate/Unit (NPR)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {s.items.map((line) => {
                const item = itemById.get(line.poItemId);
                const lineShort = line.receivedQty > 0 && line.receivedQty < line.shippedQty;
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5 font-mono text-sm text-gray-700">{item?.chineseSku ?? "-"}</td>
                    <td className="px-4 py-2.5 text-gray-700">{item?.specificName ?? "-"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{line.shippedQty}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${lineShort ? "text-orange-600 font-semibold" : "text-gray-700 font-medium"}`}>
                      {line.receivedQty || "-"}
                    </td>
                    {s.actualCustomDate && (
                      <td className="px-4 py-2.5 text-right">
                        <CustomRateInput
                          shipmentId={s.id}
                          poId={poId}
                          shipmentItemId={line.id}
                          value={line.actualCustomRateNPR}
                          onSaved={onRefresh}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {s.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-center text-gray-400 text-sm">
                    No item lines recorded for this shipment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isReceiving && (
        <ReceivingForm shipment={s} itemById={itemById} poId={poId} onDone={onReceivingDone} />
      )}
    </div>
  );
}

const attachmentTypeLabels: Record<Attachment["type"], string> = {
  PI: "PI",
  CI: "CI",
  COSTING_SHEET: "Costing Sheet",
  OTHER: "Other",
};

function fmtFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsTab({ po, onRefresh }: { po: PO; onRefresh: () => Promise<void> }) {
  const [type, setType] = useState<Attachment["type"]>("PI");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      const res = await fetch(`/api/purchase-orders/${po.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(attachmentId: string) {
    if (!confirm("Delete this attachment?")) return;
    await fetch(`/api/purchase-orders/${po.id}/attachments/${attachmentId}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded p-4 flex items-end gap-3">
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Attachment Type</span>
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as Attachment["type"])}
          >
            <option value="PI">PI</option>
            <option value="CI">CI</option>
            <option value="COSTING_SHEET">Costing Sheet</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "+ Add Attachment"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf,.xls,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Type <span className="text-red-600">*</span></th>
              <th className="px-3 py-2">File Name</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {po.attachments.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2">{attachmentTypeLabels[a.type]}</td>
                <td className="px-3 py-2">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {a.fileName}
                  </a>
                </td>
                <td className="px-3 py-2">{fmtFileSize(a.fileSize)}</td>
                <td className="px-3 py-2">{fmtDate(a.uploadedAt)}</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:underline text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {po.attachments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  No attachments uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotesTab({ po, onRefresh }: { po: PO; onRefresh: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save note");
      }
      setText("");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/purchase-orders/${po.id}/notes/${noteId}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white border rounded p-4 space-y-2">
        <textarea
          className="input w-full min-h-[100px] resize-y"
          placeholder="Add a note or update about this PO — production status, supplier communication, issues, etc."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Post Note"}
        </button>
      </form>

      <div className="space-y-3">
        {po.poNotes.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">No notes yet.</div>
        )}
        {po.poNotes.map((n) => (
          <div key={n.id} className="bg-white border rounded p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{n.content}</p>
              <button
                onClick={() => handleDelete(n.id)}
                className="text-xs text-red-400 hover:text-red-600 shrink-0"
              >
                Delete
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-400">{fmtDate(n.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
