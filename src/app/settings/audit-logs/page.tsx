import AuditLogClient from "./AuditLogClient";

export default function AuditLogsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Audit Logs & Online Users</h1>
      <AuditLogClient />
    </div>
  );
}
