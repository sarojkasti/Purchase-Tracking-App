"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function NavUser() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session) return null;

  const initials = session.user.name
    ? session.user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : session.user.email?.[0].toUpperCase() ?? "?";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <span className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
          {initials}
        </span>
        <span className="hidden sm:block">{session.user.name ?? session.user.email}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border rounded shadow-lg z-50 min-w-[160px] py-1">
            <div className="px-3 py-2 border-b">
              <div className="text-xs font-medium">{session.user.name}</div>
              <div className="text-xs text-gray-500">{session.user.email}</div>
              {session.user.roleName && (
                <div className="text-xs text-gray-400 mt-0.5">{session.user.roleName}</div>
              )}
            </div>
            {session.user.permissions?.settings && (
              <Link
                href="/settings"
                className="block px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                Settings
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
