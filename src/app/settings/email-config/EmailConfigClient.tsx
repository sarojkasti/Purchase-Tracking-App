"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Config = {
  mail_tenant_id: string;
  mail_client_id: string;
  mail_client_secret: string;
  mail_sender: string;
};

const EMPTY: Config = {
  mail_tenant_id: "",
  mail_client_id: "",
  mail_client_secret: "",
  mail_sender: "",
};

export default function EmailConfigClient() {
  const [form, setForm] = useState<Config>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "sent" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/email-config")
      .then((r) => r.json())
      .then((d) => { setForm(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function set(key: keyof Config, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  }

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    setTesting(true);
    setTestError(null);
    setTestStatus("idle");
    try {
      const res = await fetch("/api/settings/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Send failed.");
      setTestStatus("sent");
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : "Send failed.");
      setTestStatus("error");
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed.");
      setStatus("saved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-700">← Settings</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold">Email Configuration</h1>
      </div>

      <p className="text-sm text-gray-500">
        These credentials are used to send password reset emails via the Microsoft Graph API.
        The app registration must have the <code className="bg-gray-100 px-1 rounded text-xs">Mail.Send</code> application permission granted in Microsoft Entra.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4">
          <Field
            label="Tenant ID"
            hint="From Azure portal → Microsoft Entra ID → Overview"
            value={form.mail_tenant_id}
            onChange={(v) => set("mail_tenant_id", v)}
          />
          <Field
            label="Client ID (Application ID)"
            hint="From your app registration → Overview"
            value={form.mail_client_id}
            onChange={(v) => set("mail_client_id", v)}
          />
          <Field
            label="Client Secret"
            hint="From app registration → Certificates & secrets. Leave unchanged to keep existing."
            value={form.mail_client_secret}
            onChange={(v) => set("mail_client_secret", v)}
            type="password"
          />
          <Field
            label="Sender Email Address"
            hint="The mailbox this app sends from (e.g. itdepartment@newmew.com)"
            value={form.mail_sender}
            onChange={(v) => set("mail_sender", v)}
            type="email"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {status === "saved" && (
            <p className="text-green-700 text-sm">Settings saved successfully.</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-gray-900 text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        <form onSubmit={handleTest} className="bg-white border rounded-lg p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Send Test Email</h2>
          <p className="text-xs text-gray-400">Sends a test email using the saved credentials above.</p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="Recipient email"
              value={testTo}
              onChange={(e) => { setTestTo(e.target.value); setTestStatus("idle"); }}
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <button
              type="submit"
              disabled={testing}
              className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {testing ? "Sending…" : "Send"}
            </button>
          </div>
          {testStatus === "sent" && <p className="text-green-700 text-sm">Test email sent successfully.</p>}
          {testError && <p className="text-red-600 text-sm">{testError}</p>}
        </form>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-0.5">{label}</label>
      <p className="text-xs text-gray-400 mb-1">{hint}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
        autoComplete="off"
      />
    </div>
  );
}
