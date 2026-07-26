"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ForexRate = {
  id: string;
  agentId: string;
  agent: { name: string };
  date: string;
  rate: number;
};

type Agent = {
  id: string;
  name: string;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ForexPage() {
  const [rates, setRates] = useState<ForexRate[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ agentId: "", date: new Date().toISOString().slice(0, 10), rate: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [ratesRes, agentsRes] = await Promise.all([fetch("/api/forex"), fetch("/api/agents")]);
    const [ratesData, agentsData] = await Promise.all([ratesRes.json(), agentsRes.json()]);
    setRates(ratesData);
    setAgents(agentsData);
    setForm((f) => (f.agentId ? f : { ...f, agentId: agentsData[0]?.id ?? "" }));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.rate || !form.agentId) return;
    setSaving(true);
    try {
      await fetch("/api/forex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ agentId: form.agentId, date: new Date().toISOString().slice(0, 10), rate: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this forex rate?")) return;
    await fetch(`/api/forex/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/masters" className="text-sm text-blue-600 hover:underline">
          ← Masters
        </Link>
        <h1 className="text-xl font-semibold mt-1">Forex Rates</h1>
        <p className="text-sm text-gray-500">
          Agent-wise daily RMB → NPR conversion rate — different agents may settle payments at
          different rates on the same day. When creating a PO, the rate auto-fills from the PO
          vendor&apos;s agent, using the latest rate on/before the order date if it falls within 7
          days either side; otherwise the closest rate from any agent is used.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={form.agentId}
          onChange={(e) => setForm({ ...form, agentId: e.target.value })}
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="border rounded px-3 py-1.5 text-sm"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <input
          type="number"
          step="0.01"
          className="border rounded px-3 py-1.5 text-sm w-32"
          placeholder="Rate"
          value={form.rate}
          onChange={(e) => setForm({ ...form, rate: e.target.value })}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 text-white text-sm px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50"
        >
          Save
        </button>
      </form>

      <div className="bg-white rounded border overflow-x-auto max-w-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {!loading &&
              rates.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.agent.name}</td>
                  <td className="px-3 py-2">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2">{r.rate}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && rates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                  No rates recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
