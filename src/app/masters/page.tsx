import Link from "next/link";
import { masterTypes } from "./masterTypes";

export default function MastersIndexPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Masters</h1>
      <p className="text-sm text-gray-500 mb-4">
        Manage reference lists used across vendors, purchase orders, and items.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Link
          href="/vendors"
          className="bg-white border rounded p-4 hover:border-gray-400 transition-colors"
        >
          <div className="font-medium">Vendors</div>
          <div className="text-sm text-gray-500 mt-1">
            Vendor terms and payment policy history
          </div>
        </Link>
        <Link
          href="/masters/agents"
          className="bg-white border rounded p-4 hover:border-gray-400 transition-colors"
        >
          <div className="font-medium">Agents</div>
          <div className="text-sm text-gray-500 mt-1">
            Agents and their freight rates by category/mode
          </div>
        </Link>
        <Link
          href="/masters/mrp-ranges"
          className="bg-white border rounded p-4 hover:border-gray-400 transition-colors"
        >
          <div className="font-medium">MRP Ranges</div>
          <div className="text-sm text-gray-500 mt-1">
            Price ranges scoped to each Brand + Item Type combination
          </div>
        </Link>
        <Link
          href="/masters/mrp-multipliers"
          className="bg-white border rounded p-4 hover:border-gray-400 transition-colors"
        >
          <div className="font-medium">MRP Multipliers</div>
          <div className="text-sm text-gray-500 mt-1">
            Brand-wise multiplier applied to landed cost to estimate MRP
          </div>
        </Link>
        <Link
          href="/masters/forex"
          className="bg-white border rounded p-4 hover:border-gray-400 transition-colors"
        >
          <div className="font-medium">Forex Rates</div>
          <div className="text-sm text-gray-500 mt-1">Daily RMB → NPR conversion rate</div>
        </Link>
        <Link
          href="/masters/colors"
          className="bg-white border rounded p-4 hover:border-gray-400 transition-colors"
        >
          <div className="font-medium">Colors</div>
          <div className="text-sm text-gray-500 mt-1">Color names and factory serial codes</div>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {masterTypes.map((m) => (
          <Link
            key={m.type}
            href={`/masters/${m.type}`}
            className="bg-white border rounded p-4 hover:border-gray-400 transition-colors"
          >
            <div className="font-medium">{m.label}</div>
            <div className="text-sm text-gray-500 mt-1">{m.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
