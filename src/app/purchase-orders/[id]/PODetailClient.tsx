"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  SkuAutocomplete,
  ItemImageInput,
  ColorMultiSelect,
  deriveCategory,
  deriveSize,
  type Product as ProductLookup,
  type Color,
} from "@/components/ItemRowInputs";

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

type Shipment = {
  id: string;
  shippingDate: string;
  transportMode: string;
  shippedQty: number;
  receivedQty: number | null;
  arrivalDate: string | null;
  status: string;
  notes: string | null;
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
  status: string;
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
  paidAdvanceRMB: number;
  paidAdvanceNPR: number;
  advancePaymentStatus: string;
  estBalanceRMB: number;
  estBalanceNPR: number;
  estBalanceDate: string | null;
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
};

const statusOptions = [
  "DRAFT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "QC",
  "SHIPPED",
  "AT_CUSTOM",
  "RECEIVED",
  "CANCELLED",
];

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
  const [tab, setTab] = useState<"overview" | "items" | "payments" | "shipping" | "attachments">("overview");
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
          <select
            className="border rounded px-2 py-1 text-sm"
            value={po.status}
            onChange={(e) => updatePO({ status: e.target.value })}
            disabled={saving}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <button onClick={handleDeletePO} className="text-red-600 text-sm hover:underline">
            Delete PO
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b mb-4">
        {(["overview", "items", "payments", "shipping", "attachments"] as const).map((t) => (
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
      {tab === "shipping" && <ShippingTab po={po} onRefresh={refresh} />}
      {tab === "attachments" && <AttachmentsTab po={po} onRefresh={refresh} />}

      <style jsx global>{`
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

  const [costs, setCosts] = useState({
    printingCostRMB: String(po.printingCostRMB || ""),
    chinaFreightCostRMB: String(po.chinaFreightCostRMB || ""),
    inspectionCostRMB: String(po.inspectionCostRMB || ""),
  });
  const [costsSaving, setCostsSaving] = useState(false);

  const extraCostsRMB =
    (parseFloat(costs.printingCostRMB) || 0) +
    (parseFloat(costs.chinaFreightCostRMB) || 0) +
    (parseFloat(costs.inspectionCostRMB) || 0);
  const totalPOAmountRMB = po.piAmountRMB + extraCostsRMB;
  const convRate = po.piAmountRMB ? po.piAmountNPR / po.piAmountRMB : 0;
  const totalPOAmountNPR = po.piAmountNPR + extraCostsRMB * convRate;

  async function saveCosts() {
    setCostsSaving(true);
    try {
      await onUpdate({
        printingCostRMB: costs.printingCostRMB || 0,
        chinaFreightCostRMB: costs.chinaFreightCostRMB || 0,
        inspectionCostRMB: costs.inspectionCostRMB || 0,
      });
    } finally {
      setCostsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Units Ordered" value={po.unitsOrdered.toLocaleString()} />
        <StatCard label="Units Shipped" value={po.unitsShipped.toLocaleString()} />
        <StatCard label="Units Received" value={po.unitsReceived.toLocaleString()} />
        <StatCard
          label="PI Amount"
          value={`¥${po.piAmountRMB.toLocaleString()}`}
          sub={`NPR ${po.piAmountNPR.toLocaleString()}`}
        />
      </div>

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
        <div className="mt-3">
          <button
            type="button"
            onClick={saveCosts}
            disabled={costsSaving}
            className="rounded bg-gray-900 text-white text-sm px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50"
          >
            {costsSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded p-4">
          <h3 className="text-sm font-medium mb-3">Advance Payment</h3>
          <Row label="Estimated" value={`¥${po.estAdvanceRMB.toLocaleString()} / NPR ${po.estAdvanceNPR.toLocaleString()}`} />
          <Row label="Est. Date" value={fmtDate(po.estAdvanceDate)} />
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
          <Row label="Est. Date" value={fmtDate(po.estBalanceDate)} />
          <Row label="Paid" value={`¥${po.paidBalanceRMB.toLocaleString()} / NPR ${po.paidBalanceNPR.toLocaleString()}`} />
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
    convRate: defaultConvRate,
    imageUrl: "",
  };
}

function rowAmountRMB(row: { unitsOrdered: string; rateRMB: string }) {
  const units = parseFloat(row.unitsOrdered) || 0;
  const rate = parseFloat(row.rateRMB) || 0;
  return units * rate;
}

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

  function addNewRow() {
    setNewRows((rows) => [
      ...rows,
      { ...emptyNewItemRow(defaultConvRate), key: `${Date.now()}-${Math.random()}` },
    ]);
  }

  function removeNewRow(key: string) {
    setNewRows((rows) => rows.filter((r) => r.key !== key));
  }

  async function handleSavePO() {
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
              <th className="px-2 py-1.5 min-w-[9rem]">Chinese SKU</th>
              <th className="px-2 py-1.5 min-w-[9rem]">Newmew SKU</th>
              <th className="px-2 py-1.5 min-w-[11rem]">Name</th>
              <th className="px-2 py-1.5 min-w-[8rem]">Type</th>
              <th className="px-2 py-1.5 min-w-[8rem]">Brand</th>
              <th className="px-2 py-1.5 min-w-[8rem]">Mfg Type</th>
              <th className="px-2 py-1.5 min-w-[7rem]">Front</th>
              <th className="px-2 py-1.5 min-w-[7rem]">Temple</th>
              <th className="px-2 py-1.5 min-w-[7rem]">Lens</th>
              <th className="px-2 py-1.5 min-w-[8rem]">Category</th>
              <th className="px-2 py-1.5 min-w-[10rem]">Colors</th>
              <th className="px-2 py-1.5 min-w-[13rem]">Size (L-B-T)</th>
              <th className="px-2 py-1.5 min-w-[6rem]">Units</th>
              <th className="px-2 py-1.5 min-w-[7rem]">RMB Rate</th>
              <th className="px-2 py-1.5 min-w-[8rem]">Amount RMB</th>
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
                  <td className="px-1 py-1 align-top">
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
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={row.itemType}
                      onChange={(e) => updateExistingRow(item.id, { itemType: e.target.value })}
                    >
                      {itemTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={row.brand}
                      onChange={(e) => updateExistingRow(item.id, { brand: e.target.value })}
                    >
                      <option value="">-</option>
                      {brands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={row.mfgType}
                      onChange={(e) => updateExistingRow(item.id, { mfgType: e.target.value })}
                    >
                      <option value="READY_GOODS">Ready Goods</option>
                      <option value="PRODUCTION">Production</option>
                    </select>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={row.front}
                      onChange={(e) => updateExistingRow(item.id, { front: e.target.value })}
                    >
                      <option value="">-</option>
                      {frontMaterials.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={row.temple}
                      onChange={(e) => updateExistingRow(item.id, { temple: e.target.value })}
                    >
                      <option value="">-</option>
                      {templeMaterials.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={row.lens}
                      onChange={(e) => updateExistingRow(item.id, { lens: e.target.value })}
                    >
                      <option value="">-</option>
                      {lensMaterials.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input className="input bg-gray-50" value={deriveCategory(row.front, row.temple, row.lens)} disabled />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <ColorMultiSelect
                      colors={colors}
                      selected={row.colors}
                      onChange={(selected) => updateExistingRow(item.id, { colors: selected })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
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
                  <td className="px-1 py-1 align-top">
                    <input
                      type="number"
                      className="input"
                      value={row.unitsOrdered}
                      onChange={(e) => updateExistingRow(item.id, { unitsOrdered: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={row.rateRMB}
                      onChange={(e) => updateExistingRow(item.id, { rateRMB: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input className="input bg-gray-50" value={rowAmountRMB(row) ? rowAmountRMB(row).toFixed(2) : ""} disabled />
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
                  <td className="px-1 py-1 text-center align-top">
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
              <td className="px-1 py-1 align-top">
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
              <td className="px-1 py-1 align-top">
                <select
                  className="input"
                  value={newRow.itemType}
                  onChange={(e) => updateNewRow(newRow.key, { itemType: e.target.value })}
                >
                  {itemTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-1 py-1 align-top">
                <select
                  className="input"
                  value={newRow.brand}
                  onChange={(e) => updateNewRow(newRow.key, { brand: e.target.value })}
                >
                  <option value="">-</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-1 py-1 align-top">
                <select
                  className="input"
                  value={newRow.mfgType}
                  onChange={(e) => updateNewRow(newRow.key, { mfgType: e.target.value })}
                >
                  <option value="READY_GOODS">Ready Goods</option>
                  <option value="PRODUCTION">Production</option>
                </select>
              </td>
              <td className="px-1 py-1 align-top">
                <select
                  className="input"
                  value={newRow.front}
                  onChange={(e) => updateNewRow(newRow.key, { front: e.target.value })}
                >
                  <option value="">-</option>
                  {frontMaterials.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-1 py-1 align-top">
                <select
                  className="input"
                  value={newRow.temple}
                  onChange={(e) => updateNewRow(newRow.key, { temple: e.target.value })}
                >
                  <option value="">-</option>
                  {templeMaterials.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-1 py-1 align-top">
                <select
                  className="input"
                  value={newRow.lens}
                  onChange={(e) => updateNewRow(newRow.key, { lens: e.target.value })}
                >
                  <option value="">-</option>
                  {lensMaterials.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-1 py-1 align-top">
                <input className="input bg-gray-50" value={deriveCategory(newRow.front, newRow.temple, newRow.lens)} disabled />
              </td>
              <td className="px-1 py-1 align-top">
                <ColorMultiSelect
                  colors={colors}
                  selected={newRow.colors}
                  onChange={(selected) => updateNewRow(newRow.key, { colors: selected })}
                />
              </td>
              <td className="px-1 py-1 align-top">
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
              <td className="px-1 py-1 align-top">
                <input
                  type="number"
                  className="input"
                  value={newRow.unitsOrdered}
                  onChange={(e) => updateNewRow(newRow.key, { unitsOrdered: e.target.value })}
                />
              </td>
              <td className="px-1 py-1 align-top">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={newRow.rateRMB}
                  onChange={(e) => updateNewRow(newRow.key, { rateRMB: e.target.value })}
                />
              </td>
              <td className="px-1 py-1 align-top">
                <input className="input bg-gray-50" value={rowAmountRMB(newRow) ? rowAmountRMB(newRow).toFixed(2) : ""} disabled />
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
              <td className="px-1 py-1 text-center align-top">
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
      <button
        type="button"
        onClick={addNewRow}
        className="text-sm text-blue-600 hover:underline"
      >
        + Add Item Row
      </button>

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

function PaymentsTab({ po, onRefresh }: { po: PO; onRefresh: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentType: "ADVANCE",
    amountRMB: "",
    exchangeRate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to add payment");
      setForm({ paymentDate: new Date().toISOString().slice(0, 10), paymentType: "ADVANCE", amountRMB: "", exchangeRate: "", notes: "" });
      setShowForm(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(paymentId: string) {
    if (!confirm("Delete this payment?")) return;
    await fetch(`/api/purchase-orders/${po.id}/payments/${paymentId}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700">
          {showForm ? "Cancel" : "+ Record Payment"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border rounded p-4 grid grid-cols-3 gap-3">
          <input type="date" className="input" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} required />
          <select className="input" value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })}>
            <option value="ADVANCE">Advance</option>
            <option value="BALANCE">Balance</option>
            <option value="CUSTOM_DUTY">Custom Duty</option>
            <option value="OTHER">Other</option>
          </select>
          <input type="number" step="0.01" className="input" placeholder="Amount RMB" value={form.amountRMB} onChange={(e) => setForm({ ...form, amountRMB: e.target.value })} required />
          <input type="number" step="0.01" className="input" placeholder="Exchange Rate" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} required />
          <input className="input col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="col-span-3">
            <button type="submit" disabled={saving} className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50">
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">RMB</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">NPR</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {po.payments.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{fmtDate(p.paymentDate)}</td>
                <td className="px-3 py-2">{p.paymentType}</td>
                <td className="px-3 py-2">¥{p.amountRMB.toLocaleString()}</td>
                <td className="px-3 py-2">{p.exchangeRate}</td>
                <td className="px-3 py-2">NPR {p.amountNPR.toLocaleString()}</td>
                <td className="px-3 py-2">{p.notes ?? "-"}</td>
                <td className="px-3 py-2">
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

function ShippingTab({ po, onRefresh }: { po: PO; onRefresh: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shippingDate: new Date().toISOString().slice(0, 10),
    transportMode: "ROAD",
    shippedQty: "",
    receivedQty: "",
    arrivalDate: "",
    status: "SHIPPED",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to add shipment");
      setForm({
        shippingDate: new Date().toISOString().slice(0, 10),
        transportMode: "ROAD",
        shippedQty: "",
        receivedQty: "",
        arrivalDate: "",
        status: "SHIPPED",
        notes: "",
      });
      setShowForm(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(shipmentId: string) {
    if (!confirm("Delete this shipment?")) return;
    await fetch(`/api/purchase-orders/${po.id}/shipments/${shipmentId}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700">
          {showForm ? "Cancel" : "+ Add Shipment"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border rounded p-4 grid grid-cols-3 gap-3">
          <input type="date" className="input" value={form.shippingDate} onChange={(e) => setForm({ ...form, shippingDate: e.target.value })} required />
          <select className="input" value={form.transportMode} onChange={(e) => setForm({ ...form, transportMode: e.target.value })}>
            <option value="ROAD">Road</option>
            <option value="AIRWAY">Airway</option>
          </select>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="SHIPPED">Shipped</option>
            <option value="AT_CUSTOM">At Custom</option>
            <option value="CLEARED">Cleared</option>
            <option value="RECEIVED">Received</option>
          </select>
          <input type="number" className="input" placeholder="Shipped Qty" value={form.shippedQty} onChange={(e) => setForm({ ...form, shippedQty: e.target.value })} required />
          <input type="number" className="input" placeholder="Received Qty" value={form.receivedQty} onChange={(e) => setForm({ ...form, receivedQty: e.target.value })} />
          <input type="date" className="input" placeholder="Arrival Date" value={form.arrivalDate} onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })} />
          <input className="input col-span-3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="col-span-3">
            <button type="submit" disabled={saving} className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50">
              {saving ? "Saving..." : "Add Shipment"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Shipping Date</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Shipped/Received</th>
              <th className="px-3 py-2">Arrival Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {po.shipments.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">{fmtDate(s.shippingDate)}</td>
                <td className="px-3 py-2">{s.transportMode}</td>
                <td className="px-3 py-2">
                  {s.shippedQty} / {s.receivedQty ?? "-"}
                </td>
                <td className="px-3 py-2">{fmtDate(s.arrivalDate)}</td>
                <td className="px-3 py-2">{s.status}</td>
                <td className="px-3 py-2">{s.notes ?? "-"}</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:underline text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {po.shipments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No shipments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
              <th className="px-3 py-2">Type</th>
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
