"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MrpRangeItem = {
  id: string;
  brand: string;
  itemType: string;
  label: string;
  sortOrder: number;
};

export default function MrpRangesPage() {
  const [ranges, setRanges] = useState<MrpRangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState({ brand: "", itemType: "", label: "" });
  const [addLabelDraft, setAddLabelDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/mrp-ranges");
    setRanges(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const groups = new Map<string, MrpRangeItem[]>();
  for (const r of ranges) {
    const key = `${r.brand}|||${r.itemType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroup.brand.trim() || !newGroup.itemType.trim() || !newGroup.label.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/mrp-ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGroup),
      });
      setNewGroup({ brand: "", itemType: "", label: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddToGroup(brand: string, itemType: string) {
    const key = `${brand}|||${itemType}`;
    const label = addLabelDraft[key];
    if (!label?.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/mrp-ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, itemType, label: label.trim() }),
      });
      setAddLabelDraft((d) => ({ ...d, [key]: "" }));
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/mrp-ranges/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/masters" className="text-sm text-blue-600 hover:underline">
          ← Masters
        </Link>
        <h1 className="text-xl font-semibold mt-1">MRP Ranges</h1>
        <p className="text-sm text-gray-500">
          Each Brand + Item Type combination has its own set of MRP price ranges (e.g. Limitless
          Sunglasses and Limitless Frames each keep a separate list).
        </p>
      </div>

      <form
        onSubmit={handleAddGroup}
        className="bg-white border rounded p-4 grid grid-cols-4 gap-3 mb-6 max-w-2xl"
      >
        <input
          className="border rounded px-3 py-1.5 text-sm"
          placeholder="Brand (e.g. Limitless)"
          value={newGroup.brand}
          onChange={(e) => setNewGroup({ ...newGroup, brand: e.target.value })}
        />
        <input
          className="border rounded px-3 py-1.5 text-sm"
          placeholder="Item Type (e.g. Sunglasses)"
          value={newGroup.itemType}
          onChange={(e) => setNewGroup({ ...newGroup, itemType: e.target.value })}
        />
        <input
          className="border rounded px-3 py-1.5 text-sm"
          placeholder="First range (e.g. 1901-2500)"
          value={newGroup.label}
          onChange={(e) => setNewGroup({ ...newGroup, label: e.target.value })}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 text-white text-sm px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50"
        >
          + New Brand/Item Group
        </button>
      </form>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      <div className="grid grid-cols-2 gap-4">
        {[...groups.entries()].map(([key, items]) => {
          const [brand, itemType] = key.split("|||");
          return (
            <div key={key} className="bg-white border rounded p-4">
              <h3 className="text-sm font-medium mb-2">
                {brand} — {itemType}
              </h3>
              <ul className="space-y-1 mb-3">
                {items.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span>{r.label}</span>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  className="border rounded px-2 py-1 text-sm flex-1"
                  placeholder="New range, e.g. 2501-2900"
                  value={addLabelDraft[key] ?? ""}
                  onChange={(e) => setAddLabelDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
                <button
                  onClick={() => handleAddToGroup(brand, itemType)}
                  className="text-blue-600 hover:underline text-xs whitespace-nowrap"
                >
                  + Add
                </button>
              </div>
            </div>
          );
        })}
        {!loading && groups.size === 0 && (
          <p className="text-sm text-gray-500 col-span-2">
            No MRP range groups yet. Create one above.
          </p>
        )}
      </div>
    </div>
  );
}
