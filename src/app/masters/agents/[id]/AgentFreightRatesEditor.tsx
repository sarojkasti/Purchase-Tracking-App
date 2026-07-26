"use client";

import { useEffect, useState } from "react";

type Rate = {
  id: string;
  effectiveFrom: string;
  itemCategory: string;
  transportMode: string;
  rate: number;
};

const categories = ["Sunglasses", "Frames", "Clip On", "Kids"];
const modes = ["Road", "Airway"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AgentFreightRatesEditor({ agentId }: { agentId: string }) {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/agents/${agentId}/freight-rates`);
    setRates(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  function key(category: string, mode: string) {
    return `${category}|${mode}`;
  }

  function latestRate(category: string, mode: string) {
    const matches = rates
      .filter((r) => r.itemCategory === category && r.transportMode === mode)
      .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
    return matches[0];
  }

  function getInputValue(category: string, mode: string) {
    const k = key(category, mode);
    if (draft[k] !== undefined) return draft[k];
    const existing = latestRate(category, mode);
    return existing ? String(existing.rate) : "";
  }

  async function handleSave(category: string, mode: string) {
    const k = key(category, mode);
    const value = draft[k];
    if (value === undefined || value === "") return;
    setSaving(k);
    try {
      await fetch(`/api/agents/${agentId}/freight-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveFrom,
          itemCategory: category,
          transportMode: mode,
          rate: value,
        }),
      });
      await load();
      setDraft((d) => {
        const next = { ...d };
        delete next[k];
        return next;
      });
    } finally {
      setSaving(null);
    }
  }

  async function handleDeleteHistoryRow(id: string) {
    if (!confirm("Delete this rate version?")) return;
    await fetch(`/api/agents/${agentId}/freight-rates/${id}`, { method: "DELETE" });
    await load();
  }

  const historyRows = [...rates].sort(
    (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
  );

  return (
    <div className="max-w-2xl bg-white border rounded p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-1">Freight Rates by Category &amp; Mode</h3>
      <p className="text-xs text-gray-500 mb-3">
        Per-unit freight cost this agent charges, by item category and transport mode. Changing a
        value here adds a new rate version effective from the date below — past POs keep using the
        rate that was active on their order date.
      </p>

      <label className="block text-xs text-gray-600 mb-3 max-w-xs">
        New rates below take effect from
        <input
          type="date"
          className="input mt-1"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </label>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <table className="min-w-full text-sm mb-6">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-1">Category</th>
              {modes.map((m) => (
                <th key={m} className="py-1">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat} className="border-t">
                <td className="py-1.5 pr-2">{cat}</td>
                {modes.map((mode) => {
                  const k = key(cat, mode);
                  return (
                    <td key={mode} className="py-1.5 pr-2">
                      <div className="flex gap-1 items-center">
                        <input
                          type="number"
                          step="0.01"
                          className="border rounded px-2 py-1 text-sm w-24"
                          value={getInputValue(cat, mode)}
                          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                          onBlur={() => handleSave(cat, mode)}
                        />
                        {saving === k && <span className="text-xs text-gray-400">saving...</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4 className="text-xs font-medium text-gray-600 mb-2">Rate History</h4>
      <table className="min-w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th className="py-1">Effective From</th>
            <th className="py-1">Category</th>
            <th className="py-1">Mode</th>
            <th className="py-1">Rate</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {historyRows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-1">{fmtDate(r.effectiveFrom)}</td>
              <td className="py-1">{r.itemCategory}</td>
              <td className="py-1">{r.transportMode}</td>
              <td className="py-1">{r.rate}</td>
              <td className="py-1">
                <button
                  onClick={() => handleDeleteHistoryRow(r.id)}
                  className="text-red-600 hover:underline text-xs"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {historyRows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-gray-500">
                No rates recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
