"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleMicrosoft() {
    setMsLoading(true);
    await signIn("microsoft-entra-id", { callbackUrl: "/" });
  }

  const msConfigured = !!(process.env.NEXT_PUBLIC_MS_SSO_ENABLED === "true");

  return (
    <div className="space-y-4">
      {msConfigured && (
        <>
          <button
            onClick={handleMicrosoft}
            disabled={msLoading}
            className="w-full flex items-center justify-center gap-3 border rounded px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            {msLoading ? "Redirecting…" : "Sign in with Microsoft"}
          </button>
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 border-t" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="you@newmew.com"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <Link
          href="/forgot-password"
          className="block text-center text-xs text-gray-400 hover:text-gray-700"
        >
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
