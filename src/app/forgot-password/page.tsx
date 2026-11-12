"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Something went wrong.");
      }
      setStatus("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white border rounded-lg p-8 shadow-sm space-y-5">
        <div>
          <h1 className="text-lg font-semibold">Forgot password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your registered email and we&apos;ll send you a reset link.
          </p>
        </div>

        {status === "done" ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            If that email is registered, a reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="you@newmew.com"
              />
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-gray-900 text-white rounded px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {status === "loading" ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="block text-center text-xs text-gray-500 hover:text-gray-800">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
