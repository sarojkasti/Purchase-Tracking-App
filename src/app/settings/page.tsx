import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Link href="/settings/users" className="block bg-white border rounded p-4 hover:border-gray-400">
          <div className="font-medium">Users</div>
          <div className="text-sm text-gray-500 mt-1">Manage user accounts and assign roles.</div>
        </Link>
        <Link href="/settings/roles" className="block bg-white border rounded p-4 hover:border-gray-400">
          <div className="font-medium">Roles & Permissions</div>
          <div className="text-sm text-gray-500 mt-1">Create roles and configure access rights.</div>
        </Link>
        <Link href="/settings/audit-logs" className="block bg-white border rounded p-4 hover:border-gray-400">
          <div className="font-medium">Audit Logs & Online Users</div>
          <div className="text-sm text-gray-500 mt-1">View user activity, login history, and who is currently online.</div>
        </Link>
      </div>
    </div>
  );
}
