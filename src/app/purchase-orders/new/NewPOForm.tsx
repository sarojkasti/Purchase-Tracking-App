"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  SkuAutocomplete,
  ItemImageInput,
  ColorMultiSelect,
  deriveCategory,
  deriveSize,
  type Product,
  type Color,
} from "@/components/ItemRowInputs";

type Vendor = {
  id: string;
  name: string;
  shortName: string;
  agentId: string | null;
};

type PaymentPolicy = {
  advancePercent: number;
  advanceOn: string;
  balancePercent: number;
  balanceFrom: string | null;
  balanceAfterDays: number | null;
  effectiveFrom: string;
};

type ItemRow = {
  chineseSku: string;
  newmewSku: string;
  specificName: string;
  itemType: string;
  brand: string;
  mfgType: string;
  gender: string;
  sizeLens: string;
  sizeBridge: string;
  sizeTemple: string;
  front: string;
  temple: string;
  lens: string;
  colors: string[];
  unitsOrdered: string;
  rateRMB: string;
  imageUrl: string;
};

function emptyItemRow(): ItemRow {
  return {
    chineseSku: "",
    newmewSku: "",
    specificName: "",
    itemType: "Sunglasses",
    brand: "",
    mfgType: "READY_GOODS",
    gender: "",
    sizeLens: "",
    sizeBridge: "",
    sizeTemple: "",
    front: "",
    temple: "",
    lens: "",
    colors: [],
    unitsOrdered: "",
    rateRMB: "",
    imageUrl: "",
  };
}

function itemAmountRMB(item: ItemRow) {
  const units = parseFloat(item.unitsOrdered) || 0;
  const rate = parseFloat(item.rateRMB) || 0;
  return units * rate;
}

export default function NewPOForm({
  vendors,
  itemTypes,
  brands,
  frontMaterials,
  templeMaterials,
  lensMaterials,
  colors,
}: {
  vendors: Vendor[];
  itemTypes: string[];
  brands: string[];
  frontMaterials: string[];
  templeMaterials: string[];
  lensMaterials: string[];
  colors: Color[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [poSuffix, setPoSuffix] = useState("");
  const [suffixLoading, setSuffixLoading] = useState(false);
  const [piNumber, setPiNumber] = useState("");
  const [orderDateAD, setOrderDateAD] = useState(new Date().toISOString().slice(0, 10));
  const [transportMode, setTransportMode] = useState("ROAD");
  const [remarks, setRemarks] = useState("");

  const [printingCostRMB, setPrintingCostRMB] = useState("");
  const [chinaFreightCostRMB, setChinaFreightCostRMB] = useState("");
  const [inspectionCostRMB, setInspectionCostRMB] = useState("");

  const [forexRate, setForexRate] = useState<number | null>(null);
  const [forexLoading, setForexLoading] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([emptyItemRow()]);

  const [policy, setPolicy] = useState<PaymentPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  const vendor = vendors.find((v) => v.id === vendorId);
  const poNumber = useMemo(
    () => (vendor && poSuffix ? `${vendor.shortName}-${poSuffix}` : ""),
    [vendor, poSuffix]
  );

  // Auto-derive the next sequential PO suffix (1.1, 1.2, ... 1.9, 2.0, 2.1, ...)
  // for the selected vendor whenever it changes.
  useEffect(() => {
    if (!vendorId) {
      setPoSuffix("");
      return;
    }
    let cancelled = false;
    setSuffixLoading(true);
    fetch(`/api/purchase-orders/next-suffix?vendorId=${vendorId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPoSuffix(data.suffix ?? "");
      })
      .finally(() => {
        if (!cancelled) setSuffixLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  // Load the applicable payment policy whenever vendor/order date changes.
  useEffect(() => {
    if (!vendorId || !orderDateAD) {
      setPolicy(null);
      return;
    }
    let cancelled = false;
    setPolicyLoading(true);
    fetch(`/api/vendors/${vendorId}/applicable-policy?date=${orderDateAD}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPolicy(data.paymentPolicy ?? null);
      })
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId, orderDateAD]);

  // Load the applicable forex rate whenever vendor/order date changes. This
  // single rate applies to the whole PO (and every item in it) — resolved
  // from the vendor's agent in the Forex master data, not editable per item.
  useEffect(() => {
    if (!orderDateAD) {
      setForexRate(null);
      return;
    }
    let cancelled = false;
    setForexLoading(true);
    const agentId = vendor?.agentId;
    const url = agentId
      ? `/api/forex?date=${orderDateAD}&agentId=${agentId}`
      : `/api/forex?date=${orderDateAD}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setForexRate(data?.rate ?? null);
      })
      .finally(() => {
        if (!cancelled) setForexLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderDateAD, vendor?.agentId]);

  const unitsOrderedTotal = items.reduce((s, i) => s + (parseInt(i.unitsOrdered) || 0), 0);
  const piAmountRMBTotal = items.reduce((s, i) => s + itemAmountRMB(i), 0);
  const piAmountNPRTotal = piAmountRMBTotal * (forexRate ?? 0);
  const estAdvanceRMB = policy ? piAmountRMBTotal * policy.advancePercent : 0;
  const estBalanceRMB = policy ? piAmountRMBTotal * policy.balancePercent : 0;
  const extraCostsRMB =
    (parseFloat(printingCostRMB) || 0) +
    (parseFloat(chinaFreightCostRMB) || 0) +
    (parseFloat(inspectionCostRMB) || 0);
  const totalPOAmountRMB = piAmountRMBTotal + extraCostsRMB;
  const totalPOAmountNPR = piAmountNPRTotal + extraCostsRMB * (forexRate ?? 0);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addItemRow() {
    setItems((rows) => {
      const newIndex = rows.length;
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLInputElement>(
          `[data-row-first-field="${newIndex}"]`
        );
        el?.focus();
      });
      return [...rows, emptyItemRow()];
    });
  }

  function removeItemRow(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleImageUpload(index: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return;
    const data = await res.json();
    updateItem(index, { imageUrl: data.url });
  }

  function handleSkuSelect(index: number, product: Product) {
    const [sizeLens, sizeBridge, sizeTemple] = (product.size ?? "").split("-");
    // mfgType is intentionally left untouched — it's always user-editable,
    // even when the rest of the row is auto-filled from the SKU master.
    updateItem(index, {
      chineseSku: product.chineseSku,
      newmewSku: product.newmewSku ?? "",
      specificName: product.specificName ?? "",
      itemType: product.itemType ?? items[index].itemType,
      brand: product.brand ?? items[index].brand,
      gender: product.gender ?? "",
      sizeLens: sizeLens || "",
      sizeBridge: sizeBridge || "",
      sizeTemple: sizeTemple || "",
      front: product.front ?? "",
      temple: product.temple ?? "",
      lens: product.lens ?? "",
      imageUrl: product.imageUrl ?? items[index].imageUrl,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const validItems = items
        .filter((i) => i.chineseSku || i.specificName || i.unitsOrdered)
        .map((i) => ({
          ...i,
          category: deriveCategory(i.front, i.temple, i.lens),
          size: deriveSize(i.sizeLens, i.sizeBridge, i.sizeTemple),
          amountRMB: itemAmountRMB(i),
          convRate: forexRate ?? undefined,
        }));
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poNumber,
          piNumber,
          vendorId,
          orderDateAD,
          transportMode,
          unitsOrdered: unitsOrderedTotal,
          piAmountRMB: piAmountRMBTotal,
          piAmountNPR: piAmountNPRTotal,
          printingCostRMB,
          chinaFreightCostRMB,
          inspectionCostRMB,
          estAdvanceRMB,
          estAdvanceNPR: estAdvanceRMB * (forexRate ?? 0),
          estBalanceRMB,
          estBalanceNPR: estBalanceRMB * (forexRate ?? 0),
          remarks,
          items: validItems,
        }),
      });
      if (!res.ok) throw new Error("Failed to create purchase order");
      const po = await res.json();
      router.push(`/purchase-orders/${po.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl bg-white border rounded p-6 space-y-4">
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Vendor" required>
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.shortName})
              </option>
            ))}
          </select>
        </Field>
        <Field label="PO Number Suffix" required>
          <input
            className="input bg-gray-50 font-mono"
            value={suffixLoading ? "Loading..." : poSuffix}
            disabled
            required
          />
        </Field>
        <Field label="Full PO Number">
          <input className="input bg-gray-50 font-mono" value={poNumber} disabled />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="CHN PI No" required>
          <input
            className="input"
            value={piNumber}
            onChange={(e) => setPiNumber(e.target.value)}
            required
          />
        </Field>
        <Field label="Order Date" required>
          <input
            type="date"
            className="input"
            value={orderDateAD}
            onChange={(e) => setOrderDateAD(e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Transport Mode">
          <select className="input" value={transportMode} onChange={(e) => setTransportMode(e.target.value)}>
            <option value="ROAD">Road</option>
            <option value="AIRWAY">Airway</option>
          </select>
        </Field>
        <Field label="Units Ordered (auto-summed from items)">
          <input className="input bg-gray-50" value={unitsOrderedTotal} disabled />
        </Field>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Item-wise Details</h3>
          <div className="flex items-center gap-3">
            {forexLoading && <span className="text-xs text-gray-400">Loading forex rate...</span>}
            {!forexLoading && forexRate && (
              <span className="text-xs text-gray-500">Forex on order date: {forexRate}</span>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Chinese SKU is required and doubles as a product master — start typing to pick a
          previously used SKU and its details auto-fill (Mfg Type stays editable). New SKUs are
          remembered after saving. Category is derived automatically from Front + Temple + Lens.
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
              {items.map((item, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-1 py-1 align-top">
                    <SkuAutocomplete
                      value={item.chineseSku}
                      onChange={(v) => updateItem(idx, { chineseSku: v })}
                      onSelect={(product) => handleSkuSelect(idx, product)}
                      required
                      rowIndex={idx}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      className="input"
                      value={item.newmewSku}
                      onChange={(e) => updateItem(idx, { newmewSku: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      className="input"
                      value={item.specificName}
                      onChange={(e) => updateItem(idx, { specificName: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={item.itemType}
                      onChange={(e) => updateItem(idx, { itemType: e.target.value })}
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
                      value={item.brand}
                      onChange={(e) => updateItem(idx, { brand: e.target.value })}
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
                      value={item.mfgType}
                      onChange={(e) => updateItem(idx, { mfgType: e.target.value })}
                    >
                      <option value="READY_GOODS">Ready Goods</option>
                      <option value="PRODUCTION">Production</option>
                    </select>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <select
                      className="input"
                      value={item.front}
                      onChange={(e) => updateItem(idx, { front: e.target.value })}
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
                      value={item.temple}
                      onChange={(e) => updateItem(idx, { temple: e.target.value })}
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
                      value={item.lens}
                      onChange={(e) => updateItem(idx, { lens: e.target.value })}
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
                    <input
                      className="input bg-gray-50"
                      value={deriveCategory(item.front, item.temple, item.lens)}
                      disabled
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <ColorMultiSelect
                      colors={colors}
                      selected={item.colors}
                      onChange={(selected) => updateItem(idx, { colors: selected })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="input size-box"
                        placeholder="56"
                        value={item.sizeLens}
                        onChange={(e) => updateItem(idx, { sizeLens: e.target.value.slice(0, 2) })}
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        className="input size-box"
                        placeholder="19"
                        value={item.sizeBridge}
                        onChange={(e) => updateItem(idx, { sizeBridge: e.target.value.slice(0, 2) })}
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        className="input size-box"
                        placeholder="148"
                        value={item.sizeTemple}
                        onChange={(e) => updateItem(idx, { sizeTemple: e.target.value.slice(0, 3) })}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      type="number"
                      className="input"
                      value={item.unitsOrdered}
                      onChange={(e) => updateItem(idx, { unitsOrdered: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={item.rateRMB}
                      onChange={(e) => updateItem(idx, { rateRMB: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      className="input bg-gray-50"
                      value={itemAmountRMB(item) ? itemAmountRMB(item).toFixed(2) : ""}
                      disabled
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <input
                      className="input bg-gray-50"
                      value={
                        itemAmountRMB(item) && forexRate
                          ? (itemAmountRMB(item) * forexRate).toFixed(2)
                          : ""
                      }
                      disabled
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <ItemImageInput
                      imageUrl={item.imageUrl}
                      onUpload={(file) => handleImageUpload(idx, file)}
                      onClear={() => updateItem(idx, { imageUrl: "" })}
                    />
                  </td>
                  <td className="px-1 py-1 text-center align-top">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addItemRow}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          + Add Item Row
        </button>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Financials</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="PI Amount RMB (from items)">
            <input className="input bg-gray-50" value={piAmountRMBTotal ? piAmountRMBTotal.toFixed(2) : ""} disabled />
          </Field>
          <Field label="PI Amount NPR (from items)">
            <input className="input bg-gray-50" value={piAmountNPRTotal ? piAmountNPRTotal.toFixed(2) : ""} disabled />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <Field label="Printing Cost (RMB)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={printingCostRMB}
              onChange={(e) => setPrintingCostRMB(e.target.value)}
            />
          </Field>
          <Field label="China Freight Cost (RMB)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={chinaFreightCostRMB}
              onChange={(e) => setChinaFreightCostRMB(e.target.value)}
            />
          </Field>
          <Field label="Inspection Cost (RMB)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={inspectionCostRMB}
              onChange={(e) => setInspectionCostRMB(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Total PO Amount RMB">
            <input className="input bg-gray-50 font-medium" value={totalPOAmountRMB ? totalPOAmountRMB.toFixed(2) : ""} disabled />
          </Field>
          <Field label="Total PO Amount NPR">
            <input className="input bg-gray-50 font-medium" value={totalPOAmountNPR ? totalPOAmountNPR.toFixed(2) : ""} disabled />
          </Field>
        </div>
        {policyLoading && <p className="text-xs text-gray-400 mt-2">Loading vendor payment terms...</p>}
        {!policyLoading && policy && (
          <p className="text-xs text-gray-500 mt-2">
            Payment terms effective from {new Date(policy.effectiveFrom).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            : Est. Advance = {(policy.advancePercent * 100).toFixed(0)}% on {policy.advanceOn} ={" "}
            {estAdvanceRMB.toFixed(2)} RMB · Est. Balance = {(policy.balancePercent * 100).toFixed(0)}%
            {policy.balanceFrom ? ` (${policy.balanceAfterDays ?? 0}d after ${policy.balanceFrom})` : ""} ={" "}
            {estBalanceRMB.toFixed(2)} RMB
          </p>
        )}
        {!policyLoading && !policy && vendorId && (
          <p className="text-xs text-amber-600 mt-2">
            No payment policy found for this vendor. Add one from the vendor&apos;s edit page first.
          </p>
        )}
      </div>

      <Field label="Remarks">
        <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Purchase Order"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/purchase-orders")}
          className="rounded border text-sm px-4 py-2 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: 2px solid #111827;
          outline-offset: -1px;
        }
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
    </form>
  );
}

function Field({
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
      <span className="block text-sm text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
