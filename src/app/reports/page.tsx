import Link from "next/link";

export default function ReportsIndexPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Reports</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Link
          href="/reports/purchase-orders"
          className="block bg-white border rounded p-4 hover:border-gray-400"
        >
          <div className="font-medium">PO-wise Master Sheet</div>
          <div className="text-sm text-gray-500 mt-1">
            One row per purchase order — vendor, dates, status, full financials.
          </div>
        </Link>
        <Link
          href="/reports/items"
          className="block bg-white border rounded p-4 hover:border-gray-400"
        >
          <div className="font-medium">PO Item-wise Master Sheet</div>
          <div className="text-sm text-gray-500 mt-1">
            Every PO line item, one row each, with PO context flattened in.
          </div>
        </Link>
      </div>
    </div>
  );
}
