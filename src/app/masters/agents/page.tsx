"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Agent = {
  id: string;
  name: string;
  _count: { vendors: number };
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/agents");
    setAgents(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editingName.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete agent "${name}"?`)) return;
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/masters" className="text-sm text-blue-600 hover:underline">
          ← Masters
        </Link>
        <h1 className="text-xl font-semibold mt-1">Agents</h1>
        <p className="text-sm text-gray-500">
          Agents coordinate with vendors and own freight rates by category/mode.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          className="border rounded px-3 py-1.5 text-sm flex-1 max-w-sm"
          placeholder="New agent name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 text-white text-sm px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div className="bg-white rounded border overflow-x-auto max-w-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2"># Vendors</th>
              <th className="px-3 py-2 w-52"></th>
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
              agents.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">
                    {editingId === a.id ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      a.name
                    )}
                  </td>
                  <td className="px-3 py-2">{a._count.vendors}</td>
                  <td className="px-3 py-2 text-right space-x-3">
                    {editingId === a.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(a.id)}
                          className="text-green-600 hover:underline text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-500 hover:underline text-xs"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/masters/agents/${a.id}`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Manage Rates
                        </Link>
                        <button
                          onClick={() => {
                            setEditingId(a.id);
                            setEditingName(a.name);
                          }}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(a.id, a.name)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && agents.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                  No agents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
