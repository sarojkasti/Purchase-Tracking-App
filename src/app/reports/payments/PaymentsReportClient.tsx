"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

type Advice = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
};

type PaymentRow = {
  id: string;
  poId: string;
  paymentDate: string;
  poNumber: string;
  piNumber: string | null;
  vendor: string;
  agent: string | null;
  paymentType: string;
  amountRMB: number;
  exchangeRate: number;
  amountNPR: number;
  notes: string | null;
  advices: Advice[];
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function paymentTypeLabel(t: string) {
  switch (t) {
    case "ADVANCE": return "Advance";
    case "BALANCE": return "Balance";
    case "CUSTOM_DUTY": return "Custom Duty";
    case "OTHER": return "Other";
    default: return t;
  }
}

export default function PaymentsReportClient() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/reports/payments")
      .then((r) => r.json())
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [r.poNumber, r.piNumber, r.vendor, r.agent].filter(Boolean).some((v) =>
      String(v).toLowerCase().includes(q)
    );
    const matchType = typeFilter === "ALL" || r.paymentType === typeFilter;
    return matchSearch && matchType;
  });

  // Totals
  const totalRMB = filtered.reduce((s, r) => s + r.amountRMB, 0);
  const totalNPR = filtered.reduce((s, r) => s + r.amountNPR, 0);

  function handleExport() {
    const data = filtered.map((r) => ({
      "Payment Date": fmtDate(r.paymentDate),
      "PO Number": r.poNumber,
      "PI Number": r.piNumber ?? "",
      "Vendor": r.vendor,
      "Agent": r.agent ?? "",
      "Payment Type": paymentTypeLabel(r.paymentType),
      "Amount RMB": r.amountRMB,
      "Exchange Rate": r.exchangeRate,
      "Amount NPR": r.amountNPR,
      "Remarks": r.notes ?? "",
      "Evidence Count": r.advices.length,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, `Payment_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-1.5 text-sm w-64"
            placeholder="Search PO / vendor / agent / PI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="ADVANCE">Advance</option>
            <option value="BALANCE">Balance</option>
            <option value="CUSTOM_DUTY">Custom Duty</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length} payments</span>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
          >
            Export to Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded border overflow-x-auto max-h-[72vh] overflow-y-auto">
        <table className="min-w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-100 text-left text-gray-600 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2">Payment Date</th>
              <th className="px-3 py-2">PO Number</th>
              <th className="px-3 py-2">PI Number</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Amount RMB</th>
              <th className="px-3 py-2 text-right">Exchange Rate</th>
              <th className="px-3 py-2 text-right">Amount NPR</th>
              <th className="px-3 py-2">Remarks</th>
              <th className="px-3 py-2">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-gray-500">No payments found.</td></tr>
            )}
            {!loading && filtered.map((row) => (
              <tr key={row.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{fmtDate(row.paymentDate)}</td>
                <td className="px-3 py-2 font-medium">
                  <a href={`/purchase-orders/${row.poId}`} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {row.poNumber}
                  </a>
                </td>
                <td className="px-3 py-2">{row.piNumber ?? "-"}</td>
                <td className="px-3 py-2">{row.vendor}</td>
                <td className="px-3 py-2">{row.agent ?? "-"}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    row.paymentType === "ADVANCE" ? "bg-blue-100 text-blue-700" :
                    row.paymentType === "BALANCE" ? "bg-green-100 text-green-700" :
                    row.paymentType === "CUSTOM_DUTY" ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {paymentTypeLabel(row.paymentType)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">¥{row.amountRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.exchangeRate}</td>
                <td className="px-3 py-2 text-right tabular-nums">NPR {row.amountNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 max-w-[200px] truncate text-gray-600">{row.notes ?? "-"}</td>
                <td className="px-3 py-2">
                  {row.advices.length === 0 ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {row.advices.map((a, i) => (
                        <a
                          key={a.id}
                          href={a.url.startsWith("http") ? a.url : `/api/file-view?path=${encodeURIComponent(a.url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={a.fileName}
                          className="text-blue-500 hover:text-blue-700 text-xs"
                        >
                          {a.mimeType.startsWith("image/") ? "🖼" : "📄"}{i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {!loading && filtered.length > 0 && (
            <tfoot className="sticky bottom-0 bg-gray-50 border-t-2 font-medium">
              <tr>
                <td colSpan={6} className="px-3 py-2 text-right text-gray-500 text-xs">Totals ({filtered.length} payments)</td>
                <td className="px-3 py-2 text-right tabular-nums">¥{totalRMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right tabular-nums">NPR {totalNPR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
