import PaymentsReportClient from "./PaymentsReportClient";

export default function PaymentsReportPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Payment Report</h1>
      <p className="text-sm text-gray-500 mb-4">All payments across all POs in chronological order.</p>
      <PaymentsReportClient />
    </div>
  );
}
