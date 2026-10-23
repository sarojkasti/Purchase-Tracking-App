"use client";

// A fully standalone MRP estimator: no connection to the app's PO/vendor
// data (per the brief - this sits apart until the software is finalized,
// at which point it may be wired to live data). Everything here lives in
// localStorage in the browser, not the database.
//
// Calculation chain per SKU, top to bottom:
//   1. Chinese Amount (RMB) = Qty x Rate (or Rate = Amount / Qty, whichever was typed)
//   2. + apportioned Freight/Printing (one total for the batch, split by
//      each SKU's share of total Chinese Amount)
//   3. x Forex Rate -> NPR cost
//   4. + apportioned Agent Cost (one total for the batch, split by each
//      SKU's share of total NPR cost from step 3)
//   5. / Qty -> Landed Cost per unit (NPR)
//   6. + Additional Cost (Landed Cost/unit x Additional%, default 2%, editable)
//   7. + Accessory Cost/unit (from the Brand x Product Type master)
//      = Base Cost/unit
//   8. Our Price/unit = Base Cost/unit / (1 - Our Margin%)      [margin master, by brand]
//   9. Outlet Price/unit = Our Price/unit / (1 - Outlet Margin%) [margin master, by brand]
//  10. + Packaging Cost/unit (from the Brand x Product Type master)
//      = MRP/unit (the sticker price)
//  11. Selling Price/unit = MRP/unit x (1 - Brand Discount%)    [discount master, by brand]
//  12. Final Customer Price/unit = Selling Price/unit x 1.13 (VAT)

import { useEffect, useState } from "react";

type SkuRow = {
  id: string;
  sku: string;
  brand: string;
  productType: string;
  qty: string;
  rate: string;
  amount: string;
};

type BrandTypeRate = { id: string; brand: string; productType: string; rate: string };
type BrandRate = { id: string; brand: string; rate: string };

type MastersState = {
  accessory: BrandTypeRate[];
  packaging: BrandTypeRate[];
  ourMargin: BrandRate[];
  outletMargin: BrandRate[];
  discount: BrandRate[];
};

type CalcInputs = {
  freightPrintingRMB: string;
  forexRate: string;
  agentCostNPR: string;
  additionalPercent: string;
};

const STORAGE_KEY = "mrpCalculator:v1";

const emptyMasters: MastersState = {
  accessory: [],
  packaging: [],
  ourMargin: [],
  outletMargin: [],
  discount: [],
};

const defaultInputs: CalcInputs = {
  freightPrintingRMB: "",
  forexRate: "",
  agentCostNPR: "",
  additionalPercent: "2",
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptySkuRow(): SkuRow {
  return { id: newId(), sku: "", brand: "", productType: "", qty: "1", rate: "", amount: "" };
}

function n(v: string): number {
  const f = parseFloat(v);
  return Number.isFinite(f) ? f : 0;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function fmt(v: number, decimals = 2): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function MrpCalculatorClient({
  brands,
  productTypes,
}: {
  brands: string[];
  productTypes: string[];
}) {
  const [tab, setTab] = useState<"calculator" | "masters">("calculator");
  const [rows, setRows] = useState<SkuRow[]>([emptySkuRow()]);
  const [masters, setMasters] = useState<MastersState>(emptyMasters);
  const [inputs, setInputs] = useState<CalcInputs>(defaultInputs);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.rows) && data.rows.length > 0) setRows(data.rows);
        if (data.masters) setMasters({ ...emptyMasters, ...data.masters });
        if (data.inputs) setInputs({ ...defaultInputs, ...data.inputs });
      }
    } catch {
      // Ignore a corrupt or inaccessible store - the calculator just starts blank.
    }
    setLoaded(true);
  }, []);

  // Persist on every change, once the initial load has completed (so we
  // don't immediately overwrite a saved session with the blank defaults).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, masters, inputs }));
    } catch {
      // Storage full or unavailable (e.g. private browsing) - state still
      // works for this session, it just won't survive a reload.
    }
  }, [rows, masters, inputs, loaded]);

  function updateRow(id: string, patch: Partial<SkuRow>) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.qty !== undefined || patch.rate !== undefined) {
          if (patch.amount === undefined) {
            const qty = n(next.qty);
            next.amount = qty > 0 ? String(r2(qty * n(next.rate))) : next.amount;
          }
        } else if (patch.amount !== undefined) {
          const qty = n(next.qty);
          next.rate = qty > 0 ? String(r2(n(next.amount) / qty)) : next.rate;
        }
        return next;
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptySkuRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function resetAll() {
    if (!confirm("Clear all rows and reset inputs? Master tables are kept.")) return;
    setRows([emptySkuRow()]);
    setInputs(defaultInputs);
  }

  // --- calculation ---
  const totalAmountRMB = rows.reduce((s, r) => s + n(r.amount), 0);
  const freightPrinting = n(inputs.freightPrintingRMB);
  const forexRate = n(inputs.forexRate);
  const agentCostNPR = n(inputs.agentCostNPR);
  const additionalPercent = n(inputs.additionalPercent);

  const stepA = rows.map((row) => {
    const amountRMB = n(row.amount);
    const qty = n(row.qty);
    const shareOfAmount = totalAmountRMB > 0 ? amountRMB / totalAmountRMB : 0;
    const apportionedFreight = shareOfAmount * freightPrinting;
    const npr = (amountRMB + apportionedFreight) * forexRate;
    return { row, qty, amountRMB, apportionedFreight, npr };
  });
  const totalNprAfterFreight = stepA.reduce((s, r) => s + r.npr, 0);

  const results = stepA.map(({ row, qty, amountRMB, apportionedFreight, npr }) => {
    const shareOfNpr = totalNprAfterFreight > 0 ? npr / totalNprAfterFreight : 0;
    const apportionedAgent = shareOfNpr * agentCostNPR;
    const nprWithAgent = npr + apportionedAgent;
    const landedPerUnit = qty > 0 ? nprWithAgent / qty : 0;

    const additionalCost = landedPerUnit * (additionalPercent / 100);

    const accessory =
      masters.accessory.find((a) => a.brand === row.brand && a.productType === row.productType)?.rate ?? "0";
    const accessoryCost = n(accessory);

    const baseCost = landedPerUnit + additionalCost + accessoryCost;

    const ourMarginPct = n(masters.ourMargin.find((m) => m.brand === row.brand)?.rate ?? "0") / 100;
    const ourPrice = ourMarginPct < 1 ? baseCost / (1 - ourMarginPct) : baseCost;

    const outletMarginPct = n(masters.outletMargin.find((m) => m.brand === row.brand)?.rate ?? "0") / 100;
    const outletPrice = outletMarginPct < 1 ? ourPrice / (1 - outletMarginPct) : ourPrice;

    const packaging =
      masters.packaging.find((p) => p.brand === row.brand && p.productType === row.productType)?.rate ?? "0";
    const packagingCost = n(packaging);

    const mrp = outletPrice + packagingCost;

    const discountPct = n(masters.discount.find((d) => d.brand === row.brand)?.rate ?? "0") / 100;
    const sellingPrice = mrp * (1 - discountPct);

    const finalPrice = sellingPrice * 1.13;

    return {
      id: row.id,
      row,
      amountRMB,
      apportionedFreight,
      apportionedAgent,
      landedPerUnit,
      additionalCost,
      accessoryCost,
      ourPrice,
      outletPrice,
      packagingCost,
      mrp,
      sellingPrice,
      finalPrice,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">MRP Calculator</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Standalone estimator - no connection to purchase order data. Everything here is kept only in this browser.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {(["calculator", "masters"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${
              tab === t ? "border-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "calculator" && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Batch Inputs</h3>
            <div className="grid grid-cols-4 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Freight + Printing (RMB total)</span>
                <input
                  type="number"
                  className="input"
                  value={inputs.freightPrintingRMB}
                  onChange={(e) => setInputs({ ...inputs, freightPrintingRMB: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Forex Rate (RMB → NPR)</span>
                <input
                  type="number"
                  className="input"
                  value={inputs.forexRate}
                  onChange={(e) => setInputs({ ...inputs, forexRate: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Agent Cost (NPR total)</span>
                <input
                  type="number"
                  className="input"
                  value={inputs.agentCostNPR}
                  onChange={(e) => setInputs({ ...inputs, agentCostNPR: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Additional Cost %</span>
                <input
                  type="number"
                  className="input"
                  value={inputs.additionalPercent}
                  onChange={(e) => setInputs({ ...inputs, additionalPercent: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Brand</th>
                  <th className="px-3 py-2 font-medium">Product Type</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Rate (RMB)</th>
                  <th className="px-3 py-2 font-medium text-right">Amount (RMB)</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <input className="input" value={row.sku} onChange={(e) => updateRow(row.id, { sku: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <MasterSelect options={brands} value={row.brand} onChange={(v) => updateRow(row.id, { brand: v })} />
                    </td>
                    <td className="px-3 py-2">
                      <MasterSelect options={productTypes} value={row.productType} onChange={(v) => updateRow(row.id, { productType: v })} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" className="input text-right" value={row.qty} onChange={(e) => updateRow(row.id, { qty: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" className="input text-right" value={row.rate} onChange={(e) => updateRow(row.id, { rate: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" className="input text-right" value={row.amount} onChange={(e) => updateRow(row.id, { amount: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeRow(row.id)} className="text-red-600 hover:underline text-xs font-medium">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50 font-medium">
                  <td className="px-3 py-2" colSpan={5}>
                    Total Chinese Amount
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">¥{fmt(totalAmountRMB)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex gap-2">
            <button onClick={addRow} className="rounded-md border border-gray-300 text-sm font-medium text-gray-700 px-3 py-1.5 hover:bg-gray-50 transition-colors">
              + Add Row
            </button>
            <button onClick={resetAll} className="rounded-md text-sm font-medium text-gray-500 px-3 py-1.5 hover:bg-gray-50 transition-colors">
              Reset
            </button>
          </div>

          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium text-right">Landed/Unit</th>
                  <th className="px-3 py-2 font-medium text-right">+Addl.</th>
                  <th className="px-3 py-2 font-medium text-right">+Access.</th>
                  <th className="px-3 py-2 font-medium text-right">Our Price</th>
                  <th className="px-3 py-2 font-medium text-right">Outlet Price</th>
                  <th className="px-3 py-2 font-medium text-right">+Packaging</th>
                  <th className="px-3 py-2 font-medium text-right bg-indigo-50">MRP</th>
                  <th className="px-3 py-2 font-medium text-right">Selling (disc.)</th>
                  <th className="px-3 py-2 font-medium text-right bg-green-50">Final (+VAT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((res) => (
                  <tr key={res.id}>
                    <td className="px-3 py-2 font-mono text-sm text-gray-700">{res.row.sku || "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">NPR {fmt(res.landedPerUnit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">+{fmt(res.additionalCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">+{fmt(res.accessoryCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmt(res.ourPrice)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmt(res.outletPrice)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">+{fmt(res.packagingCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-700 bg-indigo-50">
                      NPR {fmt(res.mrp)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmt(res.sellingPrice)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-green-700 bg-green-50">
                      NPR {fmt(res.finalPrice)}
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-gray-400 text-sm">
                      Add a SKU row above to see the calculation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "masters" && (
        <MastersEditor masters={masters} onChange={setMasters} brands={brands} productTypes={productTypes} />
      )}

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

function MastersEditor({
  masters,
  onChange,
  brands,
  productTypes,
}: {
  masters: MastersState;
  onChange: (m: MastersState) => void;
  brands: string[];
  productTypes: string[];
}) {
  function updateBrandType(key: "accessory" | "packaging", rows: BrandTypeRate[]) {
    onChange({ ...masters, [key]: rows });
  }
  function updateBrandOnly(key: "ourMargin" | "outletMargin" | "discount", rows: BrandRate[]) {
    onChange({ ...masters, [key]: rows });
  }

  return (
    <div className="space-y-6">
      <BrandTypeTable
        title="Accessory Cost"
        subtitle="Per-unit accessory cost (NPR) added on top of landed cost, by Brand + Product Type."
        rows={masters.accessory}
        onChange={(rows) => updateBrandType("accessory", rows)}
        rateLabel="Accessory Cost (NPR)"
        brands={brands}
        productTypes={productTypes}
      />
      <BrandTypeTable
        title="Packaging Cost"
        subtitle="Per-unit packaging cost (NPR) added to Outlet Price to form MRP, by Brand + Product Type."
        rows={masters.packaging}
        onChange={(rows) => updateBrandType("packaging", rows)}
        rateLabel="Packaging Cost (NPR)"
        brands={brands}
        productTypes={productTypes}
      />
      <BrandOnlyTable
        title="Our Margin"
        subtitle="Our margin % on sale price (Price = Cost ÷ (1 − Margin%)), by Brand."
        rows={masters.ourMargin}
        onChange={(rows) => updateBrandOnly("ourMargin", rows)}
        rateLabel="Margin %"
        brands={brands}
      />
      <BrandOnlyTable
        title="Outlet Margin"
        subtitle="Outlet's margin % on sale price, applied on top of Our Price, by Brand."
        rows={masters.outletMargin}
        onChange={(rows) => updateBrandOnly("outletMargin", rows)}
        rateLabel="Margin %"
        brands={brands}
      />
      <BrandOnlyTable
        title="Brand Discount"
        subtitle="Discount % subtracted from MRP to get the outlet's selling price, by Brand."
        rows={masters.discount}
        onChange={(rows) => updateBrandOnly("discount", rows)}
        rateLabel="Discount %"
        brands={brands}
      />
    </div>
  );
}

// A <select> backed by an imported master list, falling back to a plain
// text input when that master is empty (e.g. before any Brand/Item Type
// has been set up elsewhere in the app) so the calculator never blocks on
// missing masters.
function MasterSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (options.length === 0) {
    return <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function BrandTypeTable({
  title,
  subtitle,
  rows,
  onChange,
  rateLabel,
  brands,
  productTypes,
}: {
  title: string;
  subtitle: string;
  rows: BrandTypeRate[];
  onChange: (rows: BrandTypeRate[]) => void;
  rateLabel: string;
  brands: string[];
  productTypes: string[];
}) {
  function addRow() {
    onChange([...rows, { id: newId(), brand: "", productType: "", rate: "" }]);
  }
  function update(id: string, patch: Partial<BrandTypeRate>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">{subtitle}</p>
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium">Product Type</th>
              <th className="px-3 py-2 font-medium text-right">{rateLabel}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <MasterSelect options={brands} value={row.brand} onChange={(v) => update(row.id, { brand: v })} />
                </td>
                <td className="px-3 py-2">
                  <MasterSelect options={productTypes} value={row.productType} onChange={(v) => update(row.id, { productType: v })} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min="0" className="input text-right" value={row.rate} onChange={(e) => update(row.id, { rate: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => remove(row.id)} className="text-red-600 hover:underline text-xs font-medium">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400 text-xs">
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="mt-3 rounded-md border border-gray-300 text-xs font-medium text-gray-700 px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
        + Add Row
      </button>
    </div>
  );
}

function BrandOnlyTable({
  title,
  subtitle,
  rows,
  onChange,
  rateLabel,
  brands,
}: {
  title: string;
  subtitle: string;
  rows: BrandRate[];
  onChange: (rows: BrandRate[]) => void;
  rateLabel: string;
  brands: string[];
}) {
  function addRow() {
    onChange([...rows, { id: newId(), brand: "", rate: "" }]);
  }
  function update(id: string, patch: Partial<BrandRate>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">{subtitle}</p>
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium text-right">{rateLabel}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <MasterSelect options={brands} value={row.brand} onChange={(v) => update(row.id, { brand: v })} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min="0" max="99.9" className="input text-right" value={row.rate} onChange={(e) => update(row.id, { rate: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => remove(row.id)} className="text-red-600 hover:underline text-xs font-medium">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-400 text-xs">
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="mt-3 rounded-md border border-gray-300 text-xs font-medium text-gray-700 px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
        + Add Row
      </button>
    </div>
  );
}
