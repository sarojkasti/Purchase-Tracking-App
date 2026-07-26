import PosReportClient from "./PosReportClient";

export const dynamic = "force-dynamic";

export default function PosReportPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">PO-wise Master Sheet</h1>
      <p className="text-sm text-gray-500 mb-4">
        One row per purchase order — vendor, dates, status, and full financials. No item breakdown.
      </p>
      <PosReportClient />
    </div>
  );
}
