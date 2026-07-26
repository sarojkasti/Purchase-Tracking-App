"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type PoRow = {
  poNumber: string;
  piNumber: string | null;
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
  advancePaymentStatus: string;

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
  revisedGoodCompletionDate: string | null;
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

  discrepancyDays: number | null;
  remarks: string | null;
  sourceLink: string | null;
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
  { key: "piAmountRMB", label: "PI Amount RMB" },
  { key: "piAmountNPR", label: "PI Amount NPR" },
  { key: "estAdvanceRMB", label: "Est. Advance RMB" },
  { key: "estAdvanceNPR", label: "Est. Advance NPR" },
  { key: "estAdvanceDate", label: "Est. Advance Date", date: true },
  { key: "paidAdvanceRMB", label: "Paid Advance RMB" },
  { key: "paidAdvanceNPR", label: "Paid Advance NPR" },
  { key: "advancePaymentStatus", label: "Advance Payment Status" },
  { key: "estBalanceRMB", label: "Est. Balance RMB" },
  { key: "estBalanceNPR", label: "Est. Balance NPR" },
  { key: "estBalanceDate", label: "Est. Balance Date", date: true },
  { key: "paidBalanceRMB", label: "Paid Balance RMB" },
  { key: "paidBalanceNPR", label: "Paid Balance NPR" },
  { key: "balancePaymentStatus", label: "Balance Payment Status" },
  { key: "estCustomAmountNPR", label: "Est. Custom Amount NPR" },
  { key: "actualCustomAmountNPR", label: "Actual Custom Amount NPR" },
  { key: "printingCostRMB", label: "Printing Cost RMB" },
  { key: "chinaFreightCostRMB", label: "China Freight Cost RMB" },
  { key: "inspectionCostRMB", label: "Inspection Cost RMB" },
  { key: "totalPOAmountRMB", label: "Total PO Amount RMB" },
  { key: "estGoodCompletionDate", label: "Est. Good Completion Date", date: true },
  { key: "revisedGoodCompletionDate", label: "Revised Good Completion Date", date: true },
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
  { key: "discrepancyDays", label: "Discrepancy Days" },
  { key: "remarks", label: "Remarks" },
  { key: "sourceLink", label: "Source Link" },
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
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

export default function PosReportClient() {
  const [rows, setRows] = useState<PoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/reports/purchase-orders")
      .then((res) => res.json())
      .then((data) => setRows(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.poNumber, r.vendor, r.agent, r.piNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  function handleExport() {
    const data = filtered.map((row) =>
      Object.fromEntries(
        columns.map((col) => [
          col.label,
          col.date
            ? fmtDate(row[col.key] as string)
            : typeof row[col.key] === "boolean"
            ? (row[col.key] ? "Yes" : "No")
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
        <input
          className="border rounded px-3 py-1.5 text-sm w-72"
          placeholder="Search PO / vendor / agent / PI No..."
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
                  No purchase orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
