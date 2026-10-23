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
  specificName: string | null;
  itemType: string | null;
  mfgType: string | null;
  brand: string | null;
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

type Payment = {
  id: string;
  paymentDate: string;
  paymentType: string;
  amountRMB: number;
  exchangeRate: number;
  amountNPR: number;
  notes: string | null;
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
  receivingEvents: ReceivingEvent[];
};

type Shipment = {
  id: string;
  shippingDate: string;
  transportMode: string;
  shippedQty: number;
  receivedQty: number | null;
  arrivalDate: string | null;
  status: string;
  notes: string | null;
  receivingConfirmed: boolean;
  items: ShipmentItem[];
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
  vendor: { id: string; name: string; shortName: string; agentId: string | null };
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
  actualArrivalDateAD: string | null;
  remarks: string | null;
  items: Item[];
  payments: Payment[];
  shipments: Shipment[];
  attachments: Attachment[];
  stageEvents: StageEventRecord[];
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
  frontMaterials,
  templeMaterials,
  lensMaterials,
  colors,
}: {
  po: PO;
  itemTypes: string[];
  brands: string[];
  frontMaterials: string[];
  templeMaterials: string[];
  lensMaterials: string[];
  colors: Color[];
}) {
  const router = useRouter();
  const [po, setPo] = useState(initialPo);
  const [tab, setTab] = useState<"overview" | "items" | "payments" | "ledger" | "shipping" | "history" | "attachments">("overview");
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

      <div className="flex gap-1 border-b mb-4">
        {(["overview", "items", "payments", "ledger", "shipping", "history", "attachments"] as const).map((t) => (
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
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab po={po} onUpdate={updatePO} />}
      {tab === "history" && <HistoryTab po={po} onRefresh={refresh} />}
      {tab === "items" && (
        <ItemsTab
          po={po}
          onRefresh={refresh}
          itemTypes={itemTypes}
          brands={brands}
          frontMaterials={frontMaterials}
          templeMaterials={templeMaterials}
          lensMaterials={lensMaterials}
          colors={colors}
        />
      )}
      {tab === "payments" && <PaymentsTab po={po} onRefresh={refresh} />}
      {tab === "ledger" && <LedgerTab po={po} />}
      {tab === "shipping" && <ShippingTab po={po} onRefresh={refresh} />}
      {tab === "attachments" && <AttachmentsTab po={po} onRefresh={refresh} />}

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
}: {
  po: PO;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [dates, setDates] = useState({
    estGoodCompletionDate: toInputDate(po.estGoodCompletionDate),
    actualGoodCompletionDate: toInputDate(po.actualGoodCompletionDate),
    estFactoryShipmentDate: toInputDate(po.estFactoryShipmentDate),
    actualFactoryShipmentDate: toInputDate(po.actualFactoryShipmentDate),
    estCustomArrivalDate: toInputDate(po.estCustomArrivalDate),
    actualCustomDate: toInputDate(po.actualCustomDate),
    estArrivalDateAD: toInputDate(po.estArrivalDateAD),
    actualArrivalDateAD: toInputDate(po.actualArrivalDateAD),
  });

  const advancePaidTotalRMB = po.payments
    .filter((p) => p.paymentType === "ADVANCE")
    .reduce((s, p) => s + p.amountRMB, 0);
  const advanceCarriedRMB =
    po.estAdvanceRMB > 0 ? Math.round(Math.max(advancePaidTotalRMB - po.estAdvanceRMB, 0) * 100) / 100 : 0;

  const extraCostsRMB = po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB;
  const totalPOAmountRMB = po.piAmountRMB + extraCostsRMB;
  const convRate = po.piAmountRMB ? po.piAmountNPR / po.piAmountRMB : 0;
  const totalPOAmountNPR = po.piAmountNPR + extraCostsRMB * convRate;

  const [details, setDetails] = useState({
    piNumber: po.piNumber ?? "",
    orderDateAD: toInputDate(po.orderDateAD),
    transportMode: po.transportMode,
  });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const detailsChanged =
    details.piNumber !== (po.piNumber ?? "") ||
    details.orderDateAD !== toInputDate(po.orderDateAD) ||
    details.transportMode !== po.transportMode;

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
          value={`¥${totalPOAmountRMB.toLocaleString()}`}
          sub={`NPR ${totalPOAmountNPR.toLocaleString()}`}
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
        <div className="grid grid-cols-4 gap-4 items-end">
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
          <Row label="Estimated" value={`¥${po.estAdvanceRMB.toLocaleString()} / NPR ${po.estAdvanceNPR.toLocaleString()}`} />
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
          <Row label="Paid" value={`¥${po.paidAdvanceRMB.toLocaleString()} / NPR ${po.paidAdvanceNPR.toLocaleString()}`} />
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
          <Row label="Estimated" value={`¥${po.estBalanceRMB.toLocaleString()} / NPR ${po.estBalanceNPR.toLocaleString()}`} />
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
          <Row label="Paid" value={`¥${po.paidBalanceRMB.toLocaleString()} / NPR ${po.paidBalanceNPR.toLocaleString()}`} />
          {advanceCarriedRMB > 0 && (
            <Row
              label="Incl. from advance"
              value={<span className="text-gray-500">¥{advanceCarriedRMB.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
            />
          )}
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
            actualValue={dates.actualGoodCompletionDate}
            onEstChange={(v) => setDates({ ...dates, estGoodCompletionDate: v })}
            onActualChange={(v) => setDates({ ...dates, actualGoodCompletionDate: v })}
            onSave={() =>
              onUpdate({
                estGoodCompletionDate: dates.estGoodCompletionDate || null,
                actualGoodCompletionDate: dates.actualGoodCompletionDate || null,
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
          <DatePairField
            label="Nepal Arrival"
            estValue={dates.estArrivalDateAD}
            actualValue={dates.actualArrivalDateAD}
            onEstChange={(v) => setDates({ ...dates, estArrivalDateAD: v })}
            onActualChange={(v) => setDates({ ...dates, actualArrivalDateAD: v })}
            onSave={() =>
              onUpdate({
                estArrivalDateAD: dates.estArrivalDateAD || null,
                actualArrivalDateAD: dates.actualArrivalDateAD || null,
              })
            }
          />
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
  actualValue,
  onEstChange,
  onActualChange,
  onSave,
}: {
  label: string;
  estValue: string;
  actualValue: string;
  onEstChange: (v: string) => void;
  onActualChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <label className="block text-[11px] text-gray-400">Est.</label>
      <input type="date" className="input mb-1" value={estValue} onChange={(e) => onEstChange(e.target.value)} onBlur={onSave} />
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
  specificName: string;
  itemType: string;
  brand: string;
  mfgType: string;
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
    specificName: item.specificName ?? "",
    itemType: item.itemType ?? "Sunglasses",
    brand: item.brand ?? "",
    mfgType: item.mfgType ?? "READY_GOODS",
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
    specificName: "",
    itemType: "Sunglasses",
    brand: "",
    mfgType: "READY_GOODS",
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
  frontMaterials,
  templeMaterials,
  lensMaterials,
  colors,
}: {
  po: PO;
  onRefresh: () => Promise<void>;
  itemTypes: string[];
  brands: string[];
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
      if (!res.ok) throw new Error("Failed to save changes");
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
              <th className="px-2 py-1.5 min-w-[11rem]">Name</th>
              <th className="px-2 py-1.5 min-w-[8rem]">Type <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Brand <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Mfg Type <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[7rem]">Front <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[7rem]">Temple <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[7rem]">Lens <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Category</th>
              <th className="px-2 py-1.5 min-w-[10rem]">Colors <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[13rem]">Size (L-B-T) <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[6rem]">Units <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[7rem]">RMB Rate <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Amount RMB <span className="text-red-600">*</span></th>
              <th className="px-2 py-1.5 min-w-[8rem]">Amount NPR</th>
              <th className="px-2 py-1.5 min-w-[4rem]">Image</th>
              <th className="px-2 py-1.5 w-10"></th>
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
                      onChange={(v) => updateExistingRow(item.id, { chineseSku: v })}
                      onSelect={(product) => {
                        const updated = applySkuSelect(row, product);
                        setRows((r) => ({ ...r, [item.id]: updated }));
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
                  <td className="px-1 py-1 text-center align-top whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => addNewRow()}
                      className="text-blue-600 hover:underline text-xs mr-2"
                      title="Add item row"
                    >
                      + Add
                    </button>
                    {isPendingDelete ? (
                      <button
                        type="button"
                        onClick={() => unmarkForDelete(item.id)}
                        className="text-gray-600 hover:underline text-xs"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markForDelete(item.id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {newRows.map((newRow) => (
            <tr key={newRow.key} className="border-t bg-gray-50/50">
              <td className={`px-1 py-1 align-top ${newErrs(newRow).has("chineseSku") ? "field-invalid" : ""}`}>
                <SkuAutocomplete
                  value={newRow.chineseSku}
                  onChange={(v) => updateNewRow(newRow.key, { chineseSku: v })}
                  onSelect={(product) => updateNewRow(newRow.key, applySkuSelect(newRow, product))}
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
              <td className="px-1 py-1 text-center align-top whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => addNewRow(newRow.key)}
                  className="text-blue-600 hover:underline text-xs mr-2"
                  title="Add item row below"
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => removeNewRow(newRow.key)}
                  className="text-red-600 hover:underline text-xs"
                >
                  ✕
                </button>
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
              ¥{totalPOAmountRMB.toLocaleString()}
              <span className="block text-xs text-gray-400 font-normal">
                NPR {totalPOAmountNPR.toLocaleString()}
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

  const advanceDueRMB = r2(Math.max(po.estAdvanceRMB - po.paidAdvanceRMB, 0));
  const advanceDueNPR = r2(Math.max(po.estAdvanceNPR - po.paidAdvanceNPR, 0));
  const balanceDueRMB = r2(Math.max(po.estBalanceRMB - po.paidBalanceRMB, 0));
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
            <StatCard label="PO Amount (Cr)" value={`¥${totalPOAmountRMB.toLocaleString()}`} sub={`NPR ${totalPOAmountNPR.toLocaleString()}`} />
            <StatCard label="Paid (Dr)" value={`¥${totalPaidRMB.toLocaleString()}`} sub={`NPR ${totalPaidNPR.toLocaleString()}`} />
            <StatCard
              label="Balance Payable"
              value={`¥${r2(totalPOAmountRMB - totalPaidRMB).toLocaleString()}`}
              sub={`NPR ${r2(totalPOAmountNPR - totalPaidNPR).toLocaleString()}`}
            />
          </div>
          <LedgerTable rows={mode === "summary" ? totalSummaryRows : totalDetailRows} emptyLabel="No transactions recorded yet." />
        </div>
      )}

      {ledger === "due" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Due (Cr)" value={`¥${totalDueRMB.toLocaleString()}`} sub={`NPR ${totalDueNPR.toLocaleString()}`} />
            <StatCard
              label="Total Paid (Dr)"
              value={`¥${r2(po.paidAdvanceRMB + po.paidBalanceRMB).toLocaleString()}`}
              sub={`NPR ${r2(po.paidAdvanceNPR + po.paidBalanceNPR).toLocaleString()}`}
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
                  Not Yet Due: <span className="font-medium text-gray-800">¥{notYetDueRMB.toLocaleString()}</span>{" "}
                  <span className="text-gray-400">/ NPR {notYetDueNPR.toLocaleString()}</span>
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
                        {`¥${r2(r.cr - r.dr).toLocaleString()}`}{" "}
                        <span className="text-gray-400">/ NPR {r2(r.crNPR - r.drNPR).toLocaleString()}</span>
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
  const emptyForm = () => ({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentType: "ADVANCE",
    amountRMB: "",
    exchangeRate: "",
    notes: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const fmtRMB = (n: number) => `¥${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  // Work out what is still due as if the payment being edited didn't exist. An
  // advance beyond its estimate counts toward the balance (same rule as the server).
  const others = po.payments.filter((p) => p.id !== editingId);
  const sumType = (t: string) => others.filter((p) => p.paymentType === t).reduce((s, p) => s + p.amountRMB, 0);
  const advRaw = sumType("ADVANCE");
  const balRaw = sumType("BALANCE");
  const carry = po.estAdvanceRMB > 0 ? Math.max(advRaw - po.estAdvanceRMB, 0) : 0;
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
        `This payment would bring total payments to ¥${wouldTotalRMB.toLocaleString()}, exceeding the PO total of ¥${totalPOAmountRMB.toLocaleString()} by ¥${overTotalRMB.toLocaleString()}. Reduce the amount before saving.`
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
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {po.payments.map((p) => (
              <tr key={p.id} className={`border-t ${editingId === p.id ? "bg-amber-50" : ""}`}>
                <td className="px-3 py-2">{fmtDate(p.paymentDate)}</td>
                <td className="px-3 py-2">{p.paymentType}</td>
                <td className="px-3 py-2">¥{p.amountRMB.toLocaleString()}</td>
                <td className="px-3 py-2">{p.exchangeRate}</td>
                <td className="px-3 py-2">NPR {p.amountNPR.toLocaleString()}</td>
                <td className="px-3 py-2">{p.notes ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => startEdit(p)} className="text-blue-600 hover:underline text-xs mr-3">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {po.payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
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
  receivedQty: string;
};

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingFor = (line: ShipmentItem) => line.shippedQty - line.receivedQty;

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    const entries = shipment.items
      .map((line) => ({ poItemId: line.poItemId, receivedQty: parseInt(newQtys[line.poItemId] ?? "") || 0 }))
      .filter((entry) => entry.receivedQty > 0);
    if (entries.length === 0) {
      setError("Enter a received quantity for at least one item.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/shipments/${shipment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrivalDate,
          notes,
          receivingEvents: entries.map((entry) => ({ ...entry, receivedDate: eventDate })),
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
  // Receiving can't start until this shipment has cleared customs - it must
  // be marked AT_CUSTOM first via the PO's "Mark: Custom" picker.
  const awaitingCustoms = shipment.status === "SHIPPED";

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

      {awaitingCustoms && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This shipment must be marked as at Customs before receiving can be logged. Use the PO&rsquo;s &ldquo;Mark:
          Custom&rdquo; button to select it.
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
                      <div key={ev.id}>
                        {fmtDate(ev.receivedDate)}: {ev.receivedQty}
                        {ev.notes ? ` (${ev.notes})` : ""}
                      </div>
                    ))}
                  </td>
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
        <div className="grid grid-cols-2 gap-2">
          {shipment.items.map((line) => {
            const item = itemById.get(line.poItemId);
            const remaining = remainingFor(line);
            return (
              <label key={line.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 font-mono">{item?.chineseSku ?? line.poItemId}</span>
                <span className="text-gray-400">rem. {remaining}</span>
                <input
                  type="number"
                  min="0"
                  className="input w-20"
                  placeholder="Qty"
                  disabled={awaitingCustoms}
                  value={newQtys[line.poItemId] ?? ""}
                  onChange={(e) => setNewQtys({ ...newQtys, [line.poItemId]: e.target.value })}
                />
              </label>
            );
          })}
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

type HistoryRow = {
  key: string;
  stage: Stage;
  label: string;
  dateLabel: string | null;
  shipmentLabel: string | null;
  actualDate: string;
  estimateDate: string | null;
  eventId: string;
};

function varianceLabel(actual: string, estimate: string | null) {
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

  const rows: HistoryRow[] = po.stageEvents
    .map((ev) => {
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
    })
    .sort((a, b) => new Date(a.actualDate).getTime() - new Date(b.actualDate).getTime());

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
              const variance = varianceLabel(row.actualDate, row.estimateDate);
              const isEditing = editingId === row.eventId;
              return (
                <tr key={row.key}>
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
                          onClick={() => handleSaveDate(row.eventId)}
                          disabled={saving}
                          className="text-xs font-medium text-gray-900 hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">
                          Cancel
                        </button>
                      </div>
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
    </div>
  );
}

function ShippingTab({ po, onRefresh }: { po: PO; onRefresh: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shippingDate: new Date().toISOString().slice(0, 10),
    transportMode: "ROAD",
    arrivalDate: "",
    notes: "",
  });
  const [lines, setLines] = useState<ShipmentLineForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      arrivalDate: "",
      notes: "",
    });
    setLines([]);
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
          receivedQty: "",
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
            receivedQty: l.receivedQty,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to add shipment");
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
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Expected Arrival</span>
              <input type="date" className="input" value={form.arrivalDate} onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })} />
            </label>
            <label className="block col-span-3">
              <span className="block text-xs font-medium text-gray-500 mb-1">Notes</span>
              <input className="input" placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
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
                  <th className="px-3 py-2 font-medium">Received Qty</th>
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
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={l.receivedQty}
                        onChange={(e) => updateLine(l.poItemId, { receivedQty: e.target.value })}
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
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-xs">
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
            onReceivingDone={() => {
              setReceivingId(null);
              onRefresh();
            }}
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

const SHIPMENT_STATUS_STYLES: Record<string, { dot: string; edge: string; badge: string; label: string }> = {
  SHIPPED: { dot: "bg-indigo-500", edge: "border-l-indigo-500", badge: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200", label: "Shipped" },
  AT_CUSTOM: { dot: "bg-orange-500", edge: "border-l-orange-500", badge: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200", label: "At Custom" },
  RECEIVED: { dot: "bg-green-500", edge: "border-l-green-500", badge: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200", label: "Received" },
};

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
}) {
  const style = SHIPMENT_STATUS_STYLES[s.status] ?? SHIPMENT_STATUS_STYLES.SHIPPED;
  const totalReceived = s.items.reduce((sum, line) => sum + line.receivedQty, 0);
  const isShort = s.status === "RECEIVED" && totalReceived < s.shippedQty;
  const [showDetails, setShowDetails] = useState(false);
  const rollbackLabel = s.status === "RECEIVED" ? "At Custom" : s.status === "AT_CUSTOM" ? "Shipped" : null;

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
          <button onClick={onToggleReceiving} className="font-medium text-gray-600 hover:text-gray-900 transition-colors">
            {isReceiving ? "Close" : "Update Receiving"}
          </button>
          <button onClick={onDelete} className="font-medium text-red-500 hover:text-red-700 transition-colors">
            Delete
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center gap-5 text-sm text-gray-500 flex-wrap">
        <span>{s.transportMode === "AIRWAY" ? "✈ Airway" : "🚚 Road"}</span>
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
        {s.notes && <span className="text-gray-400 italic truncate max-w-xs">&ldquo;{s.notes}&rdquo;</span>}
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
