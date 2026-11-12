"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Something went wrong.");
      setStatus("done");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-red-600">Invalid reset link. Please request a new one.</p>
    );
  }

  return (
    <>
      {status === "done" ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          Password updated. Redirecting to sign in…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">New password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirm password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-gray-900 text-white rounded px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {status === "loading" ? "Saving…" : "Set new password"}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white border rounded-lg p-8 shadow-sm space-y-5">
        <div>
          <h1 className="text-lg font-semibold">Set new password</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a strong password for your account.</p>
        </div>
        <Suspense>
          <ResetForm />
        </Suspense>
        <Link href="/login" className="block text-center text-xs text-gray-500 hover:text-gray-800">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
