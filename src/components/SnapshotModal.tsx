"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type SnapshotMeta = {
  id: string;
  type: string;
  label: string;
  createdAt: string;
  createdBy: string | null;
};

type Props = {
  reportType: "MASTER" | "ITEMS";
  currentData: unknown[];
  onLoadSnapshot: (data: unknown[], label: string) => void;
  onClearSnapshot: () => void;
  activeSnapshotLabel: string | null;
};

export default function SnapshotModal({ reportType, currentData, onLoadSnapshot, onClearSnapshot, activeSnapshotLabel }: Props) {
  const { data: session } = useSession();
  const canView = session?.user?.permissions?.snapshots_view || session?.user?.permissions?.snapshots_manage;
  const canManage = session?.user?.permissions?.snapshots_manage;

  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !canView) return;
    setLoading(true);
    fetch(`/api/snapshots?type=${reportType}`)
      .then(r => r.json())
      .then(setSnapshots)
      .catch(() => setError("Failed to load snapshots"))
      .finally(() => setLoading(false));
  }, [open, reportType, canView]);

  async function saveSnapshot() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: reportType, data: currentData }),
    });
    setSaving(false);
    if (!res.ok) { setError("Failed to save snapshot"); return; }
    const snap = await res.json();
    setSnapshots(prev => [snap, ...prev]);
  }

  async function loadSnapshot(id: string, label: string) {
    const res = await fetch(`/api/snapshots/${id}`);
    if (!res.ok) { setError("Failed to load snapshot"); return; }
    const snap = await res.json();
    onLoadSnapshot(snap.data, label);
    setOpen(false);
  }

  async function deleteSnapshot(id: string) {
    setDeleting(id);
    await fetch(`/api/snapshots/${id}`, { method: "DELETE" });
    setSnapshots(prev => prev.filter(s => s.id !== id));
    setDeleting(null);
  }

  if (!canView) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`rounded text-sm px-3 py-1.5 border ${activeSnapshotLabel ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
      >
        {activeSnapshotLabel ? `Snapshot: ${activeSnapshotLabel}` : "Snapshots"}
      </button>
      {activeSnapshotLabel && (
        <button onClick={onClearSnapshot} className="text-xs text-gray-500 hover:underline">
          Back to live
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="font-semibold text-sm">Report Snapshots</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-900 text-lg leading-none">&times;</button>
            </div>

            {canManage && (
              <div className="px-4 py-3 border-b flex items-center gap-3">
                <button
                  onClick={saveSnapshot}
                  disabled={saving || currentData.length === 0}
                  className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save current view as snapshot"}
                </button>
                <span className="text-xs text-gray-400">Auto-snapshots are saved daily.</span>
              </div>
            )}

            {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}

            <div className="overflow-y-auto flex-1">
              {loading && <p className="px-4 py-6 text-center text-sm text-gray-500">Loading…</p>}
              {!loading && snapshots.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-500">No snapshots yet.</p>
              )}
              {!loading && snapshots.map(snap => (
                <div key={snap.id} className="flex items-center justify-between px-4 py-2.5 border-b hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{snap.label}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(snap.createdAt).toLocaleString()} · {snap.createdBy ? "Manual" : "Auto"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadSnapshot(snap.id, snap.label)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </button>
                    {canManage && (
                      <button
                        onClick={() => deleteSnapshot(snap.id)}
                        disabled={deleting === snap.id}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        {deleting === snap.id ? "…" : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
