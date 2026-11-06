"use client";
import { useEffect, useState } from "react";

type LogEntry = {
  id: string;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
};

type UserEntry = {
  id: string;
  name: string | null;
  email: string;
  online: boolean;
  lastSeenAt: string | null;
  role: { name: string } | null;
};

export default function AuditLogClient() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"logs" | "online">("online");

  useEffect(() => {
    fetch(`/api/online-users`)
      .then((r) => r.json())
      .then(setUsers);
  }, []);

  useEffect(() => {
    if (tab !== "logs") return;
    fetch(`/api/audit-logs?page=${page}&limit=50`)
      .then((r) => r.json())
      .then((d) => { setLogs(d.logs); setTotal(d.total); });
  }, [tab, page]);

  const actionColor: Record<string, string> = {
    LOGIN: "bg-green-100 text-green-800",
    LOGOUT: "bg-gray-100 text-gray-700",
    CREATE: "bg-blue-100 text-blue-800",
    UPDATE: "bg-yellow-100 text-yellow-800",
    DELETE: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b">
        {(["online", "logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
            }`}
          >
            {t === "online" ? "Online Users" : "Audit Logs"}
          </button>
        ))}
      </div>

      {tab === "online" && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 border">Status</th>
              <th className="px-3 py-2 border">Name</th>
              <th className="px-3 py-2 border">Email</th>
              <th className="px-3 py-2 border">Role</th>
              <th className="px-3 py-2 border">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 border">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${u.online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.online ? "bg-green-500" : "bg-gray-400"}`} />
                    {u.online ? "Online" : "Offline"}
                  </span>
                </td>
                <td className="px-3 py-2 border">{u.name ?? "—"}</td>
                <td className="px-3 py-2 border">{u.email}</td>
                <td className="px-3 py-2 border">{u.role?.name ?? "—"}</td>
                <td className="px-3 py-2 border text-gray-500">
                  {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "logs" && (
        <>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 border">Time</th>
                <th className="px-3 py-2 border">User</th>
                <th className="px-3 py-2 border">Action</th>
                <th className="px-3 py-2 border">Entity</th>
                <th className="px-3 py-2 border">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border text-gray-500 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 border">{l.userEmail ?? "—"}</td>
                  <td className="px-3 py-2 border">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColor[l.action] ?? "bg-gray-100 text-gray-700"}`}>
                      {l.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 border text-gray-600">{l.entity ?? "—"}</td>
                  <td className="px-3 py-2 border text-gray-600">{l.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 mt-4 text-sm text-gray-600">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
            <span>Page {page} · {total} total</span>
            <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
