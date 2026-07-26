import ItemsReportClient from "./ItemsReportClient";

export const dynamic = "force-dynamic";

export default function ItemsReportPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">PO Item-wise Master Sheet</h1>
      <p className="text-sm text-gray-500 mb-4">
        Every PO line item, one row each, with PO context flattened in.
      </p>
      <ItemsReportClient />
    </div>
  );
}
