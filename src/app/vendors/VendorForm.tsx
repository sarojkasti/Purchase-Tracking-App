"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Vendor = {
  id?: string;
  name: string;
  shortName: string;
  address?: string | null;
  agentId?: string | null;
  remarks?: string | null;
};

type Agent = {
  id: string;
  name: string;
};

const initialPolicyDefaults = {
  effectiveFrom: new Date().toISOString().slice(0, 10),
  advancePercent: 0.3,
  advanceOn: "Order",
  orderConfirmAfterAdv: true,
  balancePercent: 0.7,
  balanceFrom: "Shipping",
  balanceAfterDays: 90,
};

export default function VendorForm({ vendor }: { vendor?: Vendor }) {
  const router = useRouter();
  const isEdit = !!vendor?.id;
  const [form, setForm] = useState<Vendor>(
    vendor ?? { name: "", shortName: "", address: "", agentId: "", remarks: "" }
  );
  const [policy, setPolicy] = useState(initialPolicyDefaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then(setAgents);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/vendors/${vendor!.id}` : "/api/vendors";
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit ? form : { ...form, ...policy };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save vendor");
      if (isEdit) {
        router.push(`/vendors/${vendor!.id}`);
      } else {
        const created = await res.json();
        router.push(`/vendors/${created.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!vendor?.id) return;
    if (!confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete vendor");
      router.push("/vendors");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl bg-white border rounded p-6 space-y-4">
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Vendor Name" required>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Short Name (PO prefix)" required>
          <input
            className="input font-mono"
            required
            placeholder="e.g. DTG"
            value={form.shortName}
            onChange={(e) => setForm({ ...form, shortName: e.target.value.toUpperCase() })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Agent">
          <select
            className="input"
            value={form.agentId ?? ""}
            onChange={(e) => setForm({ ...form, agentId: e.target.value || null })}
          >
            <option value="">- None -</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Manage agents from{" "}
            <a href="/masters/agents" className="text-blue-600 hover:underline">
              Masters → Agents
            </a>
            .
          </p>
        </Field>
        <Field label="Address">
          <input
            className="input"
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Remarks">
        <textarea
          className="input"
          rows={2}
          value={form.remarks ?? ""}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
        />
      </Field>

      {!isEdit && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Initial Payment Policy</h3>
          <p className="text-xs text-gray-500 mb-2">
            You can add more payment policy changes later, each with its own effective date. POs use
            whichever policy was in effect on their order date.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <Field label="Effective From" required>
              <input
                type="date"
                className="input"
                required
                value={policy.effectiveFrom}
                onChange={(e) => setPolicy({ ...policy, effectiveFrom: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Advance %">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                className="input"
                value={policy.advancePercent}
                onChange={(e) => setPolicy({ ...policy, advancePercent: parseFloat(e.target.value) })}
              />
            </Field>
            <Field label="Advance Triggered On">
              <select
                className="input"
                value={policy.advanceOn}
                onChange={(e) => setPolicy({ ...policy, advanceOn: e.target.value })}
              >
                <option value="Order">Order</option>
                <option value="Shipping">Shipping</option>
              </select>
            </Field>
            <Field label="Confirm Order After Adv.">
              <select
                className="input"
                value={policy.orderConfirmAfterAdv ? "yes" : "no"}
                onChange={(e) =>
                  setPolicy({ ...policy, orderConfirmAfterAdv: e.target.value === "yes" })
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <Field label="Balance %">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                className="input"
                value={policy.balancePercent}
                onChange={(e) => setPolicy({ ...policy, balancePercent: parseFloat(e.target.value) })}
              />
            </Field>
            <Field label="Balance Triggered From">
              <select
                className="input"
                value={policy.balanceFrom}
                onChange={(e) => setPolicy({ ...policy, balanceFrom: e.target.value })}
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
                value={policy.balanceAfterDays}
                onChange={(e) =>
                  setPolicy({ ...policy, balanceAfterDays: parseInt(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-gray-900 text-white text-sm px-4 py-2 hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Vendor"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/vendors")}
            className="rounded border text-sm px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="text-red-600 text-sm hover:underline"
          >
            Delete Vendor
          </button>
        )}
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: 2px solid #111827;
          outline-offset: -1px;
        }
      `}</style>
    </form>
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
      <span className="block text-sm text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
