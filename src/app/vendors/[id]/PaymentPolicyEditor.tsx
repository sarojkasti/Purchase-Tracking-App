"use client";

import { useEffect, useState } from "react";

type Policy = {
  id: string;
  effectiveFrom: string;
  advancePercent: number;
  advanceOn: string;
  orderConfirmAfterAdv: boolean;
  balancePercent: number;
  balanceFrom: string | null;
  balanceAfterDays: number | null;
  notes: string | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const emptyForm = {
  effectiveFrom: new Date().toISOString().slice(0, 10),
  advancePercent: "0.3",
  advanceOn: "Order",
  orderConfirmAfterAdv: true,
  balancePercent: "0.7",
  balanceFrom: "Shipping",
  balanceAfterDays: "90",
  notes: "",
};

export default function PaymentPolicyEditor({ vendorId }: { vendorId: string }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/vendors/${vendorId}/payment-policies`);
    setPolicies(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/vendors/${vendorId}/payment-policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment policy version?")) return;
    await fetch(`/api/vendors/${vendorId}/payment-policies/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-2xl bg-white border rounded p-6 mt-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-700">Payment Policy History</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm text-blue-600 hover:underline"
        >
          {showForm ? "Cancel" : "+ Add Policy Change"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Each policy applies to POs with an order date on/after its effective date, until the next
        policy takes over. The earliest policy also covers any PO dated before it.
      </p>

      {showForm && (
        <form onSubmit={handleAdd} className="border rounded p-4 mb-4 grid grid-cols-3 gap-3">
          <Field label="Effective From" required>
            <input
              type="date"
              className="input"
              required
              value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label="Advance %">
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              className="input"
              value={form.advancePercent}
              onChange={(e) => setForm({ ...form, advancePercent: e.target.value })}
            />
          </Field>
          <Field label="Advance Triggered On">
            <select
              className="input"
              value={form.advanceOn}
              onChange={(e) => setForm({ ...form, advanceOn: e.target.value })}
            >
              <option value="Order">Order</option>
              <option value="Shipping">Shipping</option>
            </select>
          </Field>
          <Field label="Confirm Order After Adv.">
            <select
              className="input"
              value={form.orderConfirmAfterAdv ? "yes" : "no"}
              onChange={(e) => setForm({ ...form, orderConfirmAfterAdv: e.target.value === "yes" })}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Balance %">
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              className="input"
              value={form.balancePercent}
              onChange={(e) => setForm({ ...form, balancePercent: e.target.value })}
            />
          </Field>
          <Field label="Balance Triggered From">
            <select
              className="input"
              value={form.balanceFrom}
              onChange={(e) => setForm({ ...form, balanceFrom: e.target.value })}
            >
              <option value="">-</option>
              <option value="Order">Order</option>
              <option value="Shipping">Shipping</option>
              <option value="Good Completion">Good Completion</option>
            </select>
          </Field>
          <Field label="Days After Trigger">
            <input
              type="number"
              className="input"
              value={form.balanceAfterDays}
              onChange={(e) => setForm({ ...form, balanceAfterDays: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Policy"}
            </button>
          </div>
        </form>
      )}

      <table className="min-w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th className="py-1">Effective From</th>
            <th className="py-1">Advance</th>
            <th className="py-1">Balance</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-500">
                Loading...
              </td>
            </tr>
          )}
          {!loading &&
            policies.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-1.5">{fmtDate(p.effectiveFrom)}</td>
                <td className="py-1.5">
                  {(p.advancePercent * 100).toFixed(0)}% on {p.advanceOn}
                </td>
                <td className="py-1.5">
                  {(p.balancePercent * 100).toFixed(0)}%
                  {p.balanceFrom ? ` (${p.balanceAfterDays ?? 0}d after ${p.balanceFrom})` : ""}
                </td>
                <td className="py-1.5">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          {!loading && policies.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-500">
                No payment policy recorded yet.
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
