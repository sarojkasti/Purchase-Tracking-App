import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, shipmentBreakdownLabel, type Stage } from "@/lib/poStages";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const stageColors: Record<Stage, string> = {
  ORDER_PLACED: "bg-gray-100 text-gray-700",
  START_PRODUCTION: "bg-yellow-100 text-yellow-700",
  PRINTING_PROCESS: "bg-yellow-100 text-yellow-700",
  GOODS_COMPLETED: "bg-blue-100 text-blue-700",
  QC: "bg-purple-100 text-purple-700",
  READY_TO_SHIP: "bg-cyan-100 text-cyan-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  CUSTOM: "bg-orange-100 text-orange-700",
  RECEIVED: "bg-green-100 text-green-700",
};

// Once shipments exist, collapsing them to the least-advanced one's stage
// hides real progress (a shipment already at Custom shouldn't disappear
// behind one still just Shipped) - show a per-stage breakdown instead
// whenever shipments disagree. See shipmentBreakdownLabel in poStages.ts.
function statusLabel(po: {
  stage: string;
  onHold: boolean;
  cancelled: boolean;
  unitsOrdered: number;
  shipments: { status: string; shippedQty: number }[];
}) {
  if (po.cancelled) return "Cancelled";
  if (po.onHold) return "On Hold";
  const stage = po.stage as Stage;
  const label = STAGE_LABELS[stage] ?? po.stage;
  if (!["SHIPPED", "CUSTOM", "RECEIVED"].includes(stage)) return label;
  return shipmentBreakdownLabel(po.shipments, label, po.unitsOrdered);
}

export default async function PurchaseOrdersPage() {
  const pos = await prisma.purchaseOrder.findMany({
    include: { vendor: true, shipments: { select: { status: true, shippedQty: true } } },
    orderBy: { orderDateAD: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Purchase Orders</h1>
        <Link
          href="/purchase-orders/new"
          className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700"
        >
          + New PO
        </Link>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">PO No</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Order Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Units (Ord/Shp/Rcv)</th>
              <th className="px-3 py-2">PO Amount (RMB)</th>
              <th className="px-3 py-2">Est. Arrival</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po) => (
              <tr key={po.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link href={`/purchase-orders/${po.id}`} className="text-blue-600 hover:underline font-mono">
                    {po.poNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{po.vendor.name}</td>
                <td className="px-3 py-2">{fmtDate(po.orderDateAD)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      po.cancelled
                        ? "bg-red-100 text-red-700"
                        : po.onHold
                        ? "bg-amber-100 text-amber-700"
                        : stageColors[po.stage as Stage] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {statusLabel(po)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {po.unitsOrdered} / {po.unitsShipped} / {po.unitsReceived}
                </td>
                <td className="px-3 py-2">
                  {(
                    po.piAmountRMB + po.printingCostRMB + po.chinaFreightCostRMB + po.inspectionCostRMB
                  ).toLocaleString()}
                </td>
                <td className="px-3 py-2">{fmtDate(po.estArrivalDateAD)}</td>
              </tr>
            ))}
            {pos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No purchase orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
