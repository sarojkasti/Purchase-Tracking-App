"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";

type PoRow = {
  poNumber: string;
  piNumber: string | null;
  piAttachmentUrl: string | null;
  vendor: string;
  agent: string | null;

  orderDateAD: string;
  orderDateBS: string | null;
  orderMonth: string | null;

  status: string;
  transportMode: string;
  brand: string | null;
  gender: string | null;

  unitsOrdered: number;
  unitsShipped: number;
  unitsReceived: number;

  piAmountRMB: number;
  piAmountNPR: number;

  estAdvanceRMB: number;
  estAdvanceNPR: number;
  estAdvanceDate: string | null;
  paidAdvanceRMB: number;
  paidAdvanceNPR: number;
  remainingAdvanceRMB: number | null;
  remainingAdvanceNPR: number | null;
  advancePaymentStatus: string;

  remainingBalanceRMB: number | null;
  remainingBalanceNPR: number | null;

  estBalanceRMB: number;
  estBalanceNPR: number;
  estBalanceDate: string | null;
  paidBalanceRMB: number;
  paidBalanceNPR: number;
  balancePaymentStatus: string;

  estCustomAmountNPR: number;
  actualCustomAmountNPR: number;

  printingCostRMB: number;
  chinaFreightCostRMB: number;
  inspectionCostRMB: number;
  totalPOAmountRMB: number;

  estGoodCompletionDate: string | null;
  actualGoodCompletionDate: string | null;

  estFactoryShipmentDate: string | null;
  actualFactoryShipmentDate: string | null;
  shipmentShifted: boolean;

  estCustomArrivalDate: string | null;
  actualCustomDate: string | null;
  estCustomClearanceDate: string | null;

  estArrivalDateAD: string | null;
  estArrivalDateBS: string | null;
  estArrivalWeek: string | null;
  actualArrivalDateAD: string | null;
  actualArrivalWeek: string | null;

};

const columns: { key: keyof PoRow; label: string; date?: boolean }[] = [
  { key: "poNumber", label: "PO Number" },
  { key: "piNumber", label: "PI Number" },
  { key: "vendor", label: "Vendor" },
  { key: "agent", label: "Agent" },
  { key: "orderDateAD", label: "Order Date (AD)", date: true },
  { key: "orderDateBS", label: "Order Date (BS)" },
  { key: "orderMonth", label: "Order Month" },
  { key: "status", label: "Status" },
  { key: "transportMode", label: "Transport Mode" },
  { key: "brand", label: "Brand" },
  { key: "gender", label: "Gender" },
  { key: "unitsOrdered", label: "Units Ordered" },
  { key: "unitsShipped", label: "Units Shipped" },
  { key: "unitsReceived", label: "Units Received" },
  { key: "totalPOAmountRMB", label: "PI Amount RMB" },
  { key: "piAmountNPR", label: "PI Amount NPR" },
  { key: "estAdvanceRMB", label: "Est. Advance RMB" },
  { key: "estAdvanceNPR", label: "Est. Advance NPR" },
  { key: "estAdvanceDate", label: "Est. Advance Date", date: true },
  { key: "paidAdvanceRMB", label: "Paid Advance RMB" },
  { key: "paidAdvanceNPR", label: "Paid Advance NPR" },
  { key: "remainingAdvanceRMB", label: "Remaining Advance RMB" },
  { key: "remainingAdvanceNPR", label: "Remaining Advance NPR" },
  { key: "advancePaymentStatus", label: "Advance Payment Status" },
  { key: "estBalanceRMB", label: "Est. Balance RMB" },
  { key: "estBalanceNPR", label: "Est. Balance NPR" },
  { key: "estBalanceDate", label: "Est. Balance Date", date: true },
  { key: "paidBalanceRMB", label: "Paid Balance RMB" },
  { key: "paidBalanceNPR", label: "Paid Balance NPR" },
  { key: "remainingBalanceRMB", label: "Remaining Balance RMB" },
  { key: "remainingBalanceNPR", label: "Remaining Balance NPR" },
  { key: "balancePaymentStatus", label: "Balance Payment Status" },
  { key: "estCustomAmountNPR", label: "Est. Custom Amount NPR" },
  { key: "actualCustomAmountNPR", label: "Actual Custom Amount NPR" },
  { key: "estGoodCompletionDate", label: "Est. Good Completion Date", date: true },
  { key: "actualGoodCompletionDate", label: "Actual Good Completion Date", date: true },
  { key: "estFactoryShipmentDate", label: "Est. Factory Shipment Date", date: true },
  { key: "actualFactoryShipmentDate", label: "Actual Factory Shipment Date", date: true },
  { key: "shipmentShifted", label: "Shipment Shifted" },
  { key: "estCustomArrivalDate", label: "Est. Custom Arrival Date", date: true },
  { key: "actualCustomDate", label: "Actual Custom Date", date: true },
  { key: "estCustomClearanceDate", label: "Est. Custom Clearance Date", date: true },
  { key: "estArrivalDateAD", label: "Est. Arrival Date (AD)", date: true },
  { key: "estArrivalDateBS", label: "Est. Arrival Date (BS)" },
  { key: "estArrivalWeek", label: "Est. Arrival Week" },
  { key: "actualArrivalDateAD", label: "Actual Arrival Date (AD)", date: true },
  { key: "actualArrivalWeek", label: "Actual Arrival Week" },
];

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCell(row: PoRow, key: keyof PoRow, isDate?: boolean) {
  const value = row[key];
  if (value === null || value === undefined || value === "") return "-";
  if (isDate) return fmtDate(value as string);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(value);
}

type SortDir = "asc" | "desc";

function cellValue(row: PoRow, key: keyof PoRow, isDate?: boolean): string {
  const v = row[key];
  if (v === null || v === undefined || v === "") return "";
  if (isDate) return fmtDate(v as string);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function sortRows(rows: PoRow[], key: keyof PoRow, dir: SortDir, isDate?: boolean): PoRow[] {
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
  sortKey: keyof PoRow | null;
  sortDir: SortDir;
  onSort: (key: keyof PoRow) => void;
  allRows: PoRow[];
  activeFilters: Map<keyof PoRow, Set<string> | null>;
  onFilter: (key: keyof PoRow, values: Set<string> | null) => void;
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

  // null = no filter (all shown); Set = explicit selection (may be empty = none shown)
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
    if (allSelected) onFilter(col.key, new Set()); // deselect all
    else onFilter(col.key, null); // select all / clear filter
  }

  return (
    <th className="px-0 py-0 relative select-none" style={{ whiteSpace: "nowrap" }}>
      <div className="flex items-center">
        <button
          className="flex items-center gap-1 px-3 py-2 hover:bg-gray-200 w-full text-left font-medium"
          onClick={() => onSort(col.key)}
        >
          <span>{col.label}</span>
          <span className="text-gray-400 text-xs ml-1">
            {isSorted ? (sortDir === "asc" ? "▲" : "▼") : ""}
          </span>
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
          title="Filter"
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

export default function PosReportClient() {
  const [rows, setRows] = useState<PoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof PoRow | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [colFilters, setColFilters] = useState<Map<keyof PoRow, Set<string> | null>>(new Map());

  useEffect(() => {
    fetch("/api/reports/purchase-orders")
      .then((res) => res.json())
      .then((data) => setRows(data))
      .finally(() => setLoading(false));
  }, []);

  function handleSort(key: keyof PoRow) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handleFilter(key: keyof PoRow, values: Set<string> | null) {
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
      [r.poNumber, r.vendor, r.agent, r.piNumber].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
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
      Object.fromEntries(
        columns.map((col) => [
          col.label,
          col.date ? fmtDate(row[col.key] as string)
            : typeof row[col.key] === "boolean" ? (row[col.key] ? "Yes" : "No")
            : row[col.key] ?? "",
        ])
      )
    );
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PO-wise Master");
    XLSX.writeFile(wb, `PO_Wise_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-1.5 text-sm w-72"
            placeholder="Search PO / vendor / agent / PI No..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {activeFilterCount > 0 && (
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setColFilters(new Map())}
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{processed.length} rows</span>
          <button
            onClick={handleExport}
            disabled={processed.length === 0}
            className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
          >
            Export to Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded border overflow-x-auto max-h-[75vh] overflow-y-auto" onClick={() => {}}>
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
            {loading && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>
            )}
            {!loading && processed.map((row, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2${typeof row[col.key] === "number" ? " text-right tabular-nums" : ""}`}>
                    {col.key === "poNumber" && row.piAttachmentUrl ? (
                      <span className="inline-flex items-center gap-1">
                        {fmtCell(row, col.key, col.date)}
                        <a
                          href={row.piAttachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open PI"
                          className="text-blue-500 hover:text-blue-700 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📎
                        </a>
                      </span>
                    ) : (
                      fmtCell(row, col.key, col.date)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && processed.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">No purchase orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
