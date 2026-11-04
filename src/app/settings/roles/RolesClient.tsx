"use client";

import { useEffect, useState } from "react";

export const PERMISSIONS = [
  { key: "dashboard",    label: "Dashboard" },
  { key: "pos_view",     label: "POs – View" },
  { key: "pos_create",   label: "POs – Create" },
  { key: "pos_edit",     label: "POs – Edit" },
  { key: "pos_delete",   label: "POs – Delete" },
  { key: "reports",      label: "Reports" },
  { key: "vendors",      label: "Vendors" },
  { key: "masters",      label: "Masters" },
  { key: "settings",     label: "Settings (Admin)" },
];

type Role = {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
  _count: { users: number };
};

const emptyPerms = () => Object.fromEntries(PERMISSIONS.map(p => [p.key, false]));

export default function RolesClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", permissions: emptyPerms() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/roles");
    if (res.ok) setRoles(await res.json());
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setForm({ name: "", permissions: emptyPerms() });
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function startEdit(role: Role) {
    setForm({ name: role.name, permissions: { ...emptyPerms(), ...role.permissions } });
    setEditing(role);
    setCreating(false);
    setError(null);
  }

  function cancel() { setCreating(false); setEditing(null); setError(null); }

  function togglePerm(key: string) {
    setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  }

  async function save() {
    if (!form.name.trim()) { setError("Role name is required."); return; }
    setSaving(true); setError(null);
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/roles/${editing.id}` : "/api/roles";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), permissions: form.permissions }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Save failed"); return; }
    cancel();
    load();
  }

  async function deleteRole(role: Role) {
    if (role._count.users > 0) { alert(`Cannot delete — ${role._count.users} user(s) assigned to this role.`); return; }
    if (!confirm(`Delete role "${role.name}"?`)) return;
    await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
    load();
  }

  const isOpen = creating || !!editing;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Roles & Permissions</h1>
        <button onClick={startCreate} className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded hover:bg-gray-700">+ New Role</button>
      </div>

      {isOpen && (
        <div className="bg-white border rounded p-4 space-y-4 max-w-lg">
          <h2 className="font-medium text-sm">{editing ? "Edit Role" : "New Role"}</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role Name</label>
            <input
              className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-gray-400"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Manager, Warehouse, Accounts"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-2">Permissions</div>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSIONS.map(p => (
                <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.permissions[p.key]}
                    onChange={() => togglePerm(p.key)}
                    className="rounded"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-gray-900 text-white text-sm px-4 py-1.5 rounded hover:bg-gray-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} className="text-sm px-4 py-1.5 rounded border hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Permissions</th>
              <th className="px-4 py-2 font-medium">Users</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role.id} className="border-t">
                <td className="px-4 py-2 font-medium">{role.name}</td>
                <td className="px-4 py-2 text-xs text-gray-600">
                  {PERMISSIONS.filter(p => role.permissions[p.key]).map(p => p.label).join(", ") || <span className="text-gray-400">No permissions</span>}
                </td>
                <td className="px-4 py-2 text-gray-500">{role._count.users}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(role)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => deleteRole(role)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No roles yet. Create one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
