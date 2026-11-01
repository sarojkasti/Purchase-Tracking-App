"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";

type ItemRow = {
  poNumber: string;
  piNumber: string | null;
  vendor: string;
  agent: string | null;
  orderDateAD: string;
  orderDateBS: string | null;
  orderMonthBS: string | null;
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
  inspectionCost: number | null;
  amountRMB: number | null;
  landedCostRMB: number | null;
  convRate: number | null;
  amountNPR: number | null;
  estCustomNPR: number | null;

  estArrivalDate: string | null;
  goodsStatus: string | null;
};

const columns: { key: keyof ItemRow; label: string; date?: boolean; sticky?: boolean; stickyLeft?: number; minWidth?: number }[] = [
  { key: "poNumber", label: "PO Number", sticky: true, stickyLeft: 0, minWidth: 120 },
  { key: "piNumber", label: "PI Number", sticky: true, stickyLeft: 120, minWidth: 100 },
  { key: "vendor", label: "Vendor" },
  { key: "agent", label: "Agent" },
  { key: "orderDateAD", label: "Order Date (AD)", date: true },
  { key: "orderDateBS", label: "Order Date (BS)" },
  { key: "orderMonthBS", label: "Order Month (BS)" },
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
  { key: "estMrp", label: "Est. MRP (auto)" },
  { key: "priceRangeLabel", label: "Price Range" },
  { key: "unitsOrdered", label: "Units Ordered" },
  { key: "shippedQty", label: "Shipped Qty" },
  { key: "receivedQty", label: "Received Qty" },
  { key: "materialCost", label: "Material Cost/Unit (RMB)" },
  { key: "printingCost", label: "Printing Cost (RMB)" },
  { key: "freightCost", label: "China Freight (RMB)" },
  { key: "inspectionCost", label: "Inspection Cost (RMB)" },
  { key: "landedCostRMB", label: "Landed Cost (RMB)" },
  { key: "convRate", label: "Conv. Rate" },
  { key: "amountNPR", label: "Amount NPR" },
  { key: "estCustomNPR", label: "Est. Custom NPR" },
  { key: "estArrivalDate", label: "Est. Arrival Date", date: true },
];

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCell(row: ItemRow, key: keyof ItemRow, isDate?: boolean) {
  const value = row[key];
  if (value === null || value === undefined || value === "") return "-";
  if (isDate) return fmtDate(value as string);
  if (typeof value === "number") return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(value);
}

type SortDir = "asc" | "desc";

function cellValue(row: ItemRow, key: keyof ItemRow, isDate?: boolean): string {
  const v = row[key];
  if (v === null || v === undefined || v === "") return "";
  if (isDate) return fmtDate(v as string);
  return String(v);
}

function sortRows(rows: ItemRow[], key: keyof ItemRow, dir: SortDir, isDate?: boolean): ItemRow[] {
  return [...rows].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else if (isDate) cmp = new Date(av as string).getTime() - new Date(bv as string).getTime();
    else cmp = String(av).localeCompare(String(bv));
    return dir === "asc" ? cmp : -cmp;
  });
}

function ColumnHeader({
  col, sortKey, sortDir, onSort, allRows, activeFilters, onFilter,
}: {
  col: typeof columns[0];
  sortKey: keyof ItemRow | null;
  sortDir: SortDir;
  onSort: (key: keyof ItemRow) => void;
  allRows: ItemRow[];
  activeFilters: Map<keyof ItemRow, Set<string> | null>;
  onFilter: (key: keyof ItemRow, values: Set<string> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isSorted = sortKey === col.key;
  const uniqueVals = useMemo(() => {
    const s = new Set<string>();
    for (const row of allRows) s.add(cellValue(row, col.key, col.date) || "(blank)");
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [allRows, col.key, col.date]);

  const rawSelected = activeFilters.get(col.key) ?? null;
  const isFiltered = rawSelected !== null;
  const selected: Set<string> = rawSelected ?? new Set(uniqueVals);
  const allSelected = !isFiltered || selected.size === uniqueVals.length;
  const noneSelected = isFiltered && selected.size === 0;
  const hasFilter = isFiltered && selected.size < uniqueVals.length;
  const filtered = search ? uniqueVals.filter(v => v.toLowerCase().includes(search.toLowerCase())) : uniqueVals;

  function toggle(val: string) {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val); else next.add(val);
    onFilter(col.key, next.size === uniqueVals.length ? null : next);
  }

  function toggleAll() {
    if (allSelected) onFilter(col.key, new Set());
    else onFilter(col.key, null);
  }

  const stickyStyle = col.sticky ? { left: col.stickyLeft, minWidth: col.minWidth } : col.minWidth ? { minWidth: col.minWidth } : undefined;

  return (
    <th
      className={`px-0 py-0 relative select-none${col.sticky ? " sticky z-20 bg-gray-100 border-r border-gray-200" : ""}`}
      style={stickyStyle}
    >
      <div className="flex items-center">
        <button
          className="flex items-center gap-1 px-3 py-2 hover:bg-gray-200 w-full text-left font-medium"
          onClick={() => onSort(col.key)}
        >
          <span>{col.label}</span>
          <span className="text-gray-400 text-xs ml-1">{isSorted ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
        </button>
        <button
          ref={btnRef}
          className={`pr-2 pl-1 py-2 hover:bg-gray-200 ${hasFilter ? "text-blue-600" : "text-gray-400"}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!open && btnRef.current) {
              const r = btnRef.current.getBoundingClientRect();
              setDropPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX });
            }
            setOpen(o => !o);
            setSearch("");
          }}
        >▾</button>
      </div>
      {open && dropPos && createPortal(
        <div
          style={{ position: "absolute", top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="bg-white border border-gray-300 rounded shadow-lg min-w-[180px] max-w-[260px]"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-2 border-b">
            <input
              autoFocus
              className="border rounded px-2 py-1 text-xs w-full"
              placeholder="Search… (Enter to apply)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (search && filtered.length > 0) {
                    onFilter(col.key, filtered.length === uniqueVals.length ? null : new Set(filtered));
                  }
                  setOpen(false);
                  setSearch("");
                }
              }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            <label className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 cursor-pointer text-xs font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = isFiltered && !allSelected && !noneSelected; }}
                onChange={toggleAll}
              />
              {allSelected ? "Unselect All" : "Select All"}
            </label>
            {filtered.map(val => (
              <label key={val} className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                <input type="checkbox" checked={!noneSelected && selected.has(val)} onChange={() => toggle(val)} />
                <span className="truncate">{val}</span>
              </label>
            ))}
          </div>
          <div className="p-2 border-t flex justify-between items-center">
            <button
              className="text-xs text-gray-500 hover:underline"
              onClick={() => {
                const inverted = new Set(uniqueVals.filter(v => !selected.has(v)));
                onFilter(col.key, inverted.size === uniqueVals.length ? null : inverted);
              }}
            >Invert</button>
            <button className="text-xs text-blue-600 hover:underline" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
        , document.body)}
    </th>
  );
}

export default function ItemsReportClient() {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof ItemRow | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [colFilters, setColFilters] = useState<Map<keyof ItemRow, Set<string> | null>>(new Map());

  useEffect(() => {
    fetch("/api/reports/items")
      .then((res) => res.json())
      .then((data) => setRows(data))
      .finally(() => setLoading(false));
  }, []);

  function handleSort(key: keyof ItemRow) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handleFilter(key: keyof ItemRow, values: Set<string> | null) {
    setColFilters(prev => {
      const next = new Map(prev);
      if (values === null) next.delete(key); else next.set(key, values);
      return next;
    });
  }

  const processed = useMemo(() => {
    let result = rows;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(r =>
      [r.poNumber, r.vendor, r.chineseSku, r.newmewSku, r.specificName].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    );
    for (const [key, allowed] of colFilters) {
      const col = columns.find(c => c.key === key);
      result = result.filter(r => {
        const v = cellValue(r, key, col?.date) || "(blank)";
        return allowed.has(v);
      });
    }
    if (sortKey) {
      const col = columns.find(c => c.key === sortKey);
      result = sortRows(result, sortKey, sortDir, col?.date);
    }
    return result;
  }, [rows, search, colFilters, sortKey, sortDir]);

  const activeFilterCount = colFilters.size;

  function handleExport() {
    const data = processed.map((row) =>
      Object.fromEntries(columns.map((col) => [col.label, col.date ? fmtDate(row[col.key] as string) : row[col.key] ?? ""]))
    );
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item-wise Master");
    XLSX.writeFile(wb, `PO_Item_Wise_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-1.5 text-sm w-72"
            placeholder="Search PO / vendor / SKU / name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {activeFilterCount > 0 && (
            <button className="text-xs text-blue-600 hover:underline" onClick={() => setColFilters(new Map())}>
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{processed.length} rows</span>
          <button onClick={handleExport} disabled={processed.length === 0} className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50">
            Export to Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded border overflow-x-auto max-h-[75vh] overflow-y-auto">
        <table className="min-w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-100 text-left text-gray-600 sticky top-0 z-30" style={{ overflow: "visible" }}>
            <tr>
              {columns.map((col) => (
                <ColumnHeader
                  key={col.key}
                  col={col}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  allRows={rows}
                  activeFilters={colFilters}
                  onFilter={handleFilter}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>}
            {!loading && processed.map((row, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2${col.sticky ? " sticky z-10 bg-white border-r border-gray-200" : ""}${typeof row[col.key] === "number" ? " text-right tabular-nums" : ""}`}
                    style={col.sticky ? { left: col.stickyLeft, minWidth: col.minWidth } : col.minWidth ? { minWidth: col.minWidth } : undefined}
                  >
                    {fmtCell(row, col.key, col.date)}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && processed.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
