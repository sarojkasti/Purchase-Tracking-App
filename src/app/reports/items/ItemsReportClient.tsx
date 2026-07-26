"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ItemRow = {
  poNumber: string;
  piNumber: string | null;
  vendor: string;
  agent: string | null;
  orderDateAD: string;
  orderDateBS: string | null;
  status: string;
  transportMode: string;
  brand: string | null;

  chineseSku: string | null;
  newmewSku: string | null;
  orderType: string | null;
  specificName: string | null;
  itemType: string | null;
  mfgType: string | null;
  category: string | null;
  gender: string | null;
  size: string | null;
  front: string | null;
  temple: string | null;
  lens: string | null;
  colors: string;
  imageUrl: string | null;
  mrp: number | null;
  estMrp: number | null;
  priceRangeLabel: string | null;

  unitsOrdered: number;
  shippedQty: number;
  receivedQty: number;

  materialCost: number | null;
  printingCost: number | null;
  freightCost: number | null;
  amountRMB: number | null;
  convRate: number | null;
  amountNPR: number | null;
  estCustomNPR: number | null;

  estArrivalDate: string | null;
  goodsStatus: string | null;
};

const columns: { key: keyof ItemRow; label: string; date?: boolean }[] = [
  { key: "poNumber", label: "PO Number" },
  { key: "piNumber", label: "PI Number" },
  { key: "vendor", label: "Vendor" },
  { key: "agent", label: "Agent" },
  { key: "orderDateAD", label: "Order Date (AD)", date: true },
  { key: "orderDateBS", label: "Order Date (BS)" },
  { key: "status", label: "PO Status" },
  { key: "transportMode", label: "Transport Mode" },
  { key: "brand", label: "Brand" },
  { key: "chineseSku", label: "Chinese SKU" },
  { key: "newmewSku", label: "Newmew SKU" },
  { key: "orderType", label: "Order Type" },
  { key: "specificName", label: "Name" },
  { key: "itemType", label: "Item Type" },
  { key: "mfgType", label: "Mfg Type" },
  { key: "category", label: "Category" },
  { key: "gender", label: "Gender" },
  { key: "size", label: "Size" },
  { key: "front", label: "Front" },
  { key: "temple", label: "Temple" },
  { key: "lens", label: "Lens" },
  { key: "colors", label: "Colors" },
  { key: "mrp", label: "MRP" },
  { key: "estMrp", label: "Est. MRP (auto)" },
  { key: "priceRangeLabel", label: "Price Range" },
  { key: "unitsOrdered", label: "Units Ordered" },
  { key: "shippedQty", label: "Shipped Qty" },
  { key: "receivedQty", label: "Received Qty" },
  { key: "materialCost", label: "Material Cost" },
  { key: "printingCost", label: "Printing Cost" },
  { key: "freightCost", label: "Freight Cost" },
  { key: "amountRMB", label: "Amount RMB" },
  { key: "convRate", label: "Conv. Rate" },
  { key: "amountNPR", label: "Amount NPR" },
  { key: "estCustomNPR", label: "Est. Custom NPR" },
  { key: "estArrivalDate", label: "Est. Arrival Date", date: true },
  { key: "goodsStatus", label: "Goods Status" },
  { key: "imageUrl", label: "Image URL" },
];

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCell(row: ItemRow, key: keyof ItemRow, isDate?: boolean) {
  const value = row[key];
  if (value === null || value === undefined || value === "") return "-";
  if (isDate) return fmtDate(value as string);
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

export default function ItemsReportClient() {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/reports/items")
      .then((res) => res.json())
      .then((data) => setRows(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.poNumber, r.vendor, r.chineseSku, r.newmewSku, r.specificName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  function handleExport() {
    const data = filtered.map((row) =>
      Object.fromEntries(
        columns.map((col) => [
          col.label,
          col.date ? fmtDate(row[col.key] as string) : row[col.key] ?? "",
        ])
      )
    );
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item-wise Master");
    XLSX.writeFile(wb, `PO_Item_Wise_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          className="border rounded px-3 py-1.5 text-sm w-72"
          placeholder="Search PO / vendor / SKU / name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length} rows</span>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
          >
            Export to Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded border overflow-x-auto max-h-[75vh] overflow-y-auto">
        <table className="min-w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-100 text-left text-gray-600 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((row, idx) => (
                <tr key={idx} className="border-t">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2">
                      {fmtCell(row, col.key, col.date)}
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
