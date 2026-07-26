"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Color = {
  id: string;
  name: string;
  code: string;
};

export default function ColorsPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/colors");
    setColors(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), code: newCode.trim() }),
      });
      setNewName("");
      setNewCode("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editingName.trim() || !editingCode.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/colors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim(), code: editingCode.trim() }),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete color "${name}"?`)) return;
    await fetch(`/api/colors/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/masters" className="text-sm text-blue-600 hover:underline">
          ← Masters
        </Link>
        <h1 className="text-xl font-semibold mt-1">Colors</h1>
        <p className="text-sm text-gray-500">
          Colors available for items, each with a factory serial code (e.g. C1, C2).
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          className="border rounded px-3 py-1.5 text-sm w-24"
          placeholder="Code (C1)"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
        />
        <input
          className="border rounded px-3 py-1.5 text-sm flex-1 max-w-sm"
          placeholder="Name (Black)"
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
              <th className="px-3 py-2 w-24">Code</th>
              <th className="px-3 py-2">Name</th>
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
              colors.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 font-mono">
                    {editingId === c.id ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={editingCode}
                        onChange={(e) => setEditingCode(e.target.value)}
                      />
                    ) : (
                      c.code
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === c.id ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      c.name
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-3">
                    {editingId === c.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(c.id)}
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
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setEditingName(c.name);
                            setEditingCode(c.code);
                          }}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && colors.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                  No colors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
