"use client";
import { useEffect } from "react";

export function OnlinePing() {
  useEffect(() => {
    const ping = () => fetch("/api/ping", { method: "POST" });
    ping();
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  }, []);
  return null;
}
