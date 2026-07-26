"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MrpMultiplier = {
  id: string;
  brand: string;
  multiplier: number;
};

export default function MrpMultipliersPage() {
  const [multipliers, setMultipliers] = useState<MrpMultiplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ brand: "", multiplier: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/mrp-multipliers");
    setMultipliers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brand.trim() || !form.multiplier) return;
    setSaving(true);
    try {
      await fetch("/api/mrp-multipliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: form.brand.trim(), multiplier: form.multiplier }),
      });
      setForm({ brand: "", multiplier: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(m: MrpMultiplier) {
    setEditingId(m.id);
    setEditingValue(String(m.multiplier));
  }

  async function handleSaveEdit(id: string) {
    if (!editingValue) return;
    setSaving(true);
    try {
      await fetch(`/api/mrp-multipliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier: editingValue }),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this brand's MRP multiplier?")) return;
    await fetch(`/api/mrp-multipliers/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/masters" className="text-sm text-blue-600 hover:underline">
          ← Masters
        </Link>
        <h1 className="text-xl font-semibold mt-1">MRP Multipliers</h1>
        <p className="text-sm text-gray-500">
          Each Brand has its own multiplier, applied to landed cost to derive MRP automatically in
          reports.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          className="border rounded px-3 py-1.5 text-sm"
          placeholder="Brand (e.g. Limitless)"
          value={form.brand}
          onChange={(e) => setForm({ ...form, brand: e.target.value })}
        />
        <input
          type="number"
          step="0.01"
          className="border rounded px-3 py-1.5 text-sm w-32"
          placeholder="Multiplier"
          value={form.multiplier}
          onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 text-white text-sm px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50"
        >
          Save
        </button>
      </form>

      <div className="bg-white rounded border overflow-x-auto max-w-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Multiplier</th>
              <th className="px-3 py-2 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {!loading &&
              multipliers.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2">{m.brand}</td>
                  <td className="px-3 py-2">
                    {editingId === m.id ? (
                      <input
                        type="number"
                        step="0.01"
                        className="border rounded px-2 py-1 text-sm w-24"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => handleSaveEdit(m.id)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(m.id)}
                        autoFocus
                      />
                    ) : (
                      <button onClick={() => startEdit(m)} className="hover:underline">
                        {m.multiplier}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && multipliers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                  No multipliers recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
