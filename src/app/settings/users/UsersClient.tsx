"use client";

import { useEffect, useState } from "react";

type Role = { id: string; name: string };
type User = { id: string; name: string | null; email: string; active: boolean; roleId: string | null; role: { name: string } | null; createdAt: string };

const emptyForm = () => ({ name: "", email: "", password: "", roleId: "", active: true });

export default function UsersClient({ roles }: { roles: Role[] }) {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setForm(emptyForm());
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function startEdit(user: User) {
    setForm({ name: user.name ?? "", email: user.email, password: "", roleId: user.roleId ?? "", active: user.active });
    setEditing(user);
    setCreating(false);
    setError(null);
  }

  function cancel() { setCreating(false); setEditing(null); setError(null); }

  async function save() {
    if (!form.email.trim()) { setError("Email is required."); return; }
    setSaving(true); setError(null);
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/users/${editing.id}` : "/api/users";
    const body: Record<string, unknown> = { name: form.name || null, email: form.email, roleId: form.roleId || null, active: form.active };
    if (form.password) body.password = form.password;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Save failed"); return; }
    cancel(); load();
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: user.name, email: user.email, roleId: user.roleId, active: !user.active }),
    });
    load();
  }

  const isOpen = creating || !!editing;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <button onClick={startCreate} className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded hover:bg-gray-700">+ New User</button>
      </div>

      {isOpen && (
        <div className="bg-white border rounded p-4 space-y-3 max-w-md">
          <h2 className="font-medium text-sm">{editing ? "Edit User" : "New User"}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email *</label>
              <input type="email" className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@newmew.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{editing ? "New Password (leave blank to keep)" : "Password"}</label>
              <input type="password" className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}>
                <option value="">— No role —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Active
            </label>
          )}
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
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t">
                <td className="px-4 py-2">{user.name ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-2 text-gray-600">{user.email}</td>
                <td className="px-4 py-2">{user.role?.name ?? <span className="text-gray-400">No role</span>}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${user.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {user.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(user)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => toggleActive(user)} className="text-xs text-gray-500 hover:underline">
                      {user.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
