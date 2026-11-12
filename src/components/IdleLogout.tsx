"use client";

import { useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

const IDLE_MS = 10 * 60 * 1000; // 10 minutes
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export default function IdleLogout() {
  const { status } = useSession();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, IDLE_MS);
    }

    reset();
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [status]);

  return null;
}
