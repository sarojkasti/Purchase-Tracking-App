"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Item = {
  id: string;
  chineseSku: string | null;
  newmewSku: string | null;
  specificName: string | null;
  itemType: string | null;
  mfgType: string | null;
  category: string | null;
  colors: string[];
  size: string | null;
  unitsOrdered: number;
  shippedQty: number;
  receivedQty: number;
  amountRMB: number | null;
  amountNPR: number | null;
  goodsStatus: string | null;
  imageUrl: string | null;
};

type Color = {
  id: string;
  name: string;
  code: string;
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
  frontMaterials,
  templeMaterials,
  lensMaterials,
  colors,
}: {
  po: PO;
  itemTypes: string[];
  frontMaterials: string[];
  templeMaterials: string[];
  lensMaterials: string[];
  colors: Color[];
}) {
  const router = useRouter();
  const [po, setPo] = useState(initialPo);
  const [tab, setTab] = useState<"overview" | "items" | "payments" | "shipping">("overview");
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
        {(["overview", "items", "payments", "shipping"] as const).map((t) => (
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
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab po={po} onUpdate={updatePO} />}
      {tab === "items" && (
        <ItemsTab
          po={po}
          onRefresh={refresh}
          itemTypes={itemTypes}
          frontMaterials={frontMaterials}
          templeMaterials={templeMaterials}
          lensMaterials={lensMaterials}
          colors={colors}
        />
      )}
      {tab === "payments" && <PaymentsTab po={po} onRefresh={refresh} />}
      {tab === "shipping" && <ShippingTab po={po} onRefresh={refresh} />}

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

  const extraCostsRMB =
    (parseFloat(costs.printingCostRMB) || 0) +
    (parseFloat(costs.chinaFreightCostRMB) || 0) +
    (parseFloat(costs.inspectionCostRMB) || 0);
  const totalPOAmountRMB = po.piAmountRMB + extraCostsRMB;
  const convRate = po.piAmountRMB ? po.piAmountNPR / po.piAmountRMB : 0;
  const totalPOAmountNPR = po.piAmountNPR + extraCostsRMB * convRate;

  function saveCosts() {
    onUpdate({
      printingCostRMB: costs.printingCostRMB || 0,
      chinaFreightCostRMB: costs.chinaFreightCostRMB || 0,
      inspectionCostRMB: costs.inspectionCostRMB || 0,
    });
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
              onBlur={saveCosts}
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
              onBlur={saveCosts}
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
              onBlur={saveCosts}
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

type ProductLookup = {
  chineseSku: string;
  newmewSku: string | null;
  specificName: string | null;
  itemType: string | null;
  gender: string | null;
  size: string | null;
  front: string | null;
  temple: string | null;
  lens: string | null;
  mrp: number | null;
  imageUrl: string | null;
};

function deriveCategory(front: string, temple: string, lens: string) {
  return [front, temple, lens].filter(Boolean).join("+");
}

function deriveSize(lens: string, bridge: string, temple: string) {
  if (!lens && !bridge && !temple) return "";
  return `${lens.padStart(2, "0")}-${bridge.padStart(2, "0")}-${temple.padStart(3, "0")}`;
}

function emptyItemForm(defaultConvRate: string) {
  return {
    chineseSku: "",
    newmewSku: "",
    specificName: "",
    itemType: "Sunglasses",
    mfgType: "READY_GOODS",
    front: "",
    temple: "",
    lens: "",
    colors: [] as string[],
    sizeLens: "",
    sizeBridge: "",
    sizeTemple: "",
    unitsOrdered: "",
    shippedQty: "",
    receivedQty: "",
    rateRMB: "",
    convRate: defaultConvRate,
    goodsStatus: "Pending",
    imageUrl: "",
  };
}

function itemFormAmountRMB(form: { unitsOrdered: string; rateRMB: string }) {
  const units = parseFloat(form.unitsOrdered) || 0;
  const rate = parseFloat(form.rateRMB) || 0;
  return units * rate;
}

function ItemsTab({
  po,
  onRefresh,
  itemTypes,
  frontMaterials,
  templeMaterials,
  lensMaterials,
  colors,
}: {
  po: PO;
  onRefresh: () => Promise<void>;
  itemTypes: string[];
  frontMaterials: string[];
  templeMaterials: string[];
  lensMaterials: string[];
  colors: Color[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyItemForm(""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const date = po.orderDateAD.slice(0, 10);
    const url = po.vendor.agentId
      ? `/api/forex?date=${date}&agentId=${po.vendor.agentId}`
      : `/api/forex?date=${date}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data?.rate) {
          setForm((f) => (f.convRate ? f : { ...f, convRate: String(data.rate) }));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSkuSelect(product: ProductLookup) {
    const [sizeLens, sizeBridge, sizeTemple] = (product.size ?? "").split("-");
    // mfgType is intentionally left untouched — it's always user-editable,
    // even when the rest of the row is auto-filled from the SKU master.
    setForm((f) => ({
      ...f,
      chineseSku: product.chineseSku,
      newmewSku: product.newmewSku ?? "",
      specificName: product.specificName ?? "",
      itemType: product.itemType ?? f.itemType,
      sizeLens: sizeLens || "",
      sizeBridge: sizeBridge || "",
      sizeTemple: sizeTemple || "",
      front: product.front ?? "",
      temple: product.temple ?? "",
      lens: product.lens ?? "",
      imageUrl: product.imageUrl ?? f.imageUrl,
    }));
  }

  async function handleImageUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return;
    const data = await res.json();
    setForm((f) => ({ ...f, imageUrl: data.url }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const category = deriveCategory(form.front, form.temple, form.lens);
      const size = deriveSize(form.sizeLens, form.sizeBridge, form.sizeTemple);
      const amountRMB = itemFormAmountRMB(form);
      const amountNPR = amountRMB && form.convRate ? amountRMB * parseFloat(form.convRate) : undefined;
      const res = await fetch(`/api/purchase-orders/${po.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category, size, amountRMB, amountNPR }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      setForm(emptyItemForm(form.convRate));
      setShowForm(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/purchase-orders/${po.id}/items/${itemId}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700"
        >
          {showForm ? "Cancel" : "+ Add Item"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border rounded p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
          <ItemField label="Chinese SKU" required>
            <SkuAutocomplete
              value={form.chineseSku}
              onChange={(v) => setForm({ ...form, chineseSku: v })}
              onSelect={handleSkuSelect}
              required
            />
          </ItemField>
          <ItemField label="Newmew SKU (optional)">
            <input className="input" value={form.newmewSku} onChange={(e) => setForm({ ...form, newmewSku: e.target.value })} />
          </ItemField>
          <ItemField label="Specific Name">
            <input className="input" value={form.specificName} onChange={(e) => setForm({ ...form, specificName: e.target.value })} />
          </ItemField>
          <ItemField label="Item Type">
            <select className="input" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })}>
              {itemTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </ItemField>
          <ItemField label="Mfg Type">
            <select className="input" value={form.mfgType} onChange={(e) => setForm({ ...form, mfgType: e.target.value })}>
              <option value="READY_GOODS">Ready Goods</option>
              <option value="PRODUCTION">Production</option>
            </select>
          </ItemField>
          <ItemField label="Front">
            <select className="input" value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })}>
              <option value="">-</option>
              {frontMaterials.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </ItemField>
          <ItemField label="Temple">
            <select className="input" value={form.temple} onChange={(e) => setForm({ ...form, temple: e.target.value })}>
              <option value="">-</option>
              {templeMaterials.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </ItemField>
          <ItemField label="Lens">
            <select className="input" value={form.lens} onChange={(e) => setForm({ ...form, lens: e.target.value })}>
              <option value="">-</option>
              {lensMaterials.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </ItemField>
          <ItemField label="Category (auto)">
            <input className="input bg-gray-50" value={deriveCategory(form.front, form.temple, form.lens)} disabled />
          </ItemField>
          <ItemField label="Colors">
            <ColorMultiSelect
              colors={colors}
              selected={form.colors}
              onChange={(selected) => setForm({ ...form, colors: selected })}
            />
          </ItemField>
          <ItemField label="Size (Lens-Bridge-Temple)">
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="input w-16 px-1 text-center"
                placeholder="56"
                maxLength={2}
                value={form.sizeLens}
                onChange={(e) => setForm({ ...form, sizeLens: e.target.value.slice(0, 2) })}
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                className="input w-16 px-1 text-center"
                placeholder="19"
                maxLength={2}
                value={form.sizeBridge}
                onChange={(e) => setForm({ ...form, sizeBridge: e.target.value.slice(0, 2) })}
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                className="input w-16 px-1 text-center"
                placeholder="148"
                maxLength={3}
                value={form.sizeTemple}
                onChange={(e) => setForm({ ...form, sizeTemple: e.target.value.slice(0, 3) })}
              />
            </div>
          </ItemField>
          <ItemField label="Units Ordered">
            <input type="number" className="input" value={form.unitsOrdered} onChange={(e) => setForm({ ...form, unitsOrdered: e.target.value })} />
          </ItemField>
          <ItemField label="Shipped Qty">
            <input type="number" className="input" value={form.shippedQty} onChange={(e) => setForm({ ...form, shippedQty: e.target.value })} />
          </ItemField>
          <ItemField label="Received Qty">
            <input type="number" className="input" value={form.receivedQty} onChange={(e) => setForm({ ...form, receivedQty: e.target.value })} />
          </ItemField>
          <ItemField label="RMB Rate">
            <input type="number" step="0.01" className="input" value={form.rateRMB} onChange={(e) => setForm({ ...form, rateRMB: e.target.value })} />
          </ItemField>
          <ItemField label="Amount RMB (auto)">
            <input className="input bg-gray-50" value={itemFormAmountRMB(form) ? itemFormAmountRMB(form).toFixed(2) : ""} disabled />
          </ItemField>
          <ItemField label="Conv. Rate (forex master)">
            <input className="input bg-gray-50" value={form.convRate} disabled />
          </ItemField>
          <ItemField label="Goods Status">
            <select className="input" value={form.goodsStatus} onChange={(e) => setForm({ ...form, goodsStatus: e.target.value })}>
              <option>Pending</option>
              <option>In Production</option>
              <option>Shipped</option>
              <option>Received</option>
            </select>
          </ItemField>
          <ItemField label="Image">
            <ItemImageInput
              imageUrl={form.imageUrl}
              onUpload={handleImageUpload}
              onClear={() => setForm({ ...form, imageUrl: "" })}
            />
          </ItemField>
          <div className="col-span-full">
            <button type="submit" disabled={saving} className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50">
              {saving ? "Adding..." : "Add Item"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Image</th>
              <th className="px-3 py-2">Chinese SKU</th>
              <th className="px-3 py-2">Newmew SKU</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Mfg Type</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Colors</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Ord/Shp/Rcv</th>
              <th className="px-3 py-2">Amount RMB</th>
              <th className="px-3 py-2">Amount NPR</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="Item" className="w-10 h-10 object-cover rounded border" />
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2 font-mono">{item.chineseSku ?? "-"}</td>
                <td className="px-3 py-2 font-mono">{item.newmewSku ?? "-"}</td>
                <td className="px-3 py-2">{item.specificName ?? "-"}</td>
                <td className="px-3 py-2">{item.itemType ?? "-"}</td>
                <td className="px-3 py-2">{item.mfgType ?? "-"}</td>
                <td className="px-3 py-2">{item.category ?? "-"}</td>
                <td className="px-3 py-2">{item.colors.length > 0 ? item.colors.join(", ") : "-"}</td>
                <td className="px-3 py-2">{item.size ?? "-"}</td>
                <td className="px-3 py-2">
                  {item.unitsOrdered} / {item.shippedQty} / {item.receivedQty}
                </td>
                <td className="px-3 py-2">
                  {item.amountRMB ? `¥${item.amountRMB.toLocaleString()}` : "-"}
                </td>
                <td className="px-3 py-2">
                  {item.amountNPR ? `NPR ${item.amountNPR.toLocaleString()}` : "-"}
                </td>
                <td className="px-3 py-2">{item.goodsStatus ?? "-"}</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {po.items.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-6 text-center text-gray-500">
                  No items added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

function ItemField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function SkuAutocomplete({
  value,
  onChange,
  onSelect,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: ProductLookup) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ProductLookup[]>([]);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/products?q=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setResults(data);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  function updatePosition() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) });
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input"
        placeholder="Chinese SKU"
        value={value}
        required={required}
        onChange={(e) => {
          onChange(e.target.value);
          updatePosition();
          setOpen(true);
        }}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
      />
      {open &&
        results.length > 0 &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 max-h-56 overflow-y-auto bg-white border rounded shadow-lg py-1"
              style={{ top: coords.top, left: coords.left, width: coords.width }}
            >
              {results.map((p) => (
                <button
                  key={p.chineseSku}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="w-6 h-6 object-cover rounded border shrink-0" />
                  ) : (
                    <span className="w-6 h-6 shrink-0" />
                  )}
                  <span className="font-mono">{p.chineseSku}</span>
                  {p.specificName && <span className="text-gray-400 truncate">{p.specificName}</span>}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function ItemImageInput({
  imageUrl,
  onUpload,
  onClear,
}: {
  imageUrl: string;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-1">
      {imageUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Item" className="w-10 h-10 object-cover rounded border" />
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-1.5 -right-1.5 bg-white border rounded-full w-4 h-4 text-[10px] leading-none text-red-600 hover:bg-red-50"
            title="Remove image"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-10 h-10 flex items-center justify-center border border-dashed rounded text-gray-400 text-xs hover:bg-gray-50 disabled:opacity-50"
          title="Upload image"
        >
          {uploading ? "…" : "+"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

function ColorMultiSelect({
  colors,
  selected,
  onChange,
}: {
  colors: Color[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }

  function handleOpen() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 192) });
    }
    setOpen((o) => !o);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="input text-left bg-white truncate"
      >
        {selected.length > 0 ? selected.join(", ") : <span className="text-gray-400">Select colors</span>}
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 max-h-56 overflow-y-auto bg-white border rounded shadow-lg py-1"
              style={{ top: coords.top, left: coords.left, width: coords.width }}
            >
              {colors.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">
                  No colors defined. Add some under Masters → Colors.
                </div>
              )}
              {colors.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c.name)}
                    onChange={() => toggle(c.name)}
                  />
                  <span className="text-gray-400 font-mono text-xs">{c.code}</span>
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
