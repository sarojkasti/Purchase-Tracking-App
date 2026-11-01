import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, shipmentBreakdownLabel, type Stage } from "@/lib/poStages";
import SkuSearch from "@/components/SkuSearch";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(po: { stage: string; onHold: boolean; cancelled: boolean; unitsOrdered: number; shipments: { status: string; shippedQty: number }[] }) {
  if (po.cancelled) return "Cancelled";
  if (po.onHold) return "On Hold";
  const stage = po.stage as Stage;
  const label = STAGE_LABELS[stage] ?? po.stage;
  if (!["SHIPPED", "CUSTOM", "RECEIVED"].includes(stage)) return label;
  return shipmentBreakdownLabel(po.shipments, label, po.unitsOrdered);
}

export default async function DashboardPage() {
  const [pos, vendors] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { vendor: true, shipments: { select: { status: true, shippedQty: true } } } }),
    prisma.vendor.count(),
  ]);

  const activePos = pos.filter((p) => p.stage !== "RECEIVED" && !p.cancelled);
  const totalUnitsInTransit = activePos.reduce((s, p) => s + (p.unitsShipped - p.unitsReceived), 0);
  const totalPendingAdvanceRMB = pos
    .filter((p) => p.advancePaymentStatus !== "PAID")
    .reduce((s, p) => s + (p.estAdvanceRMB - p.paidAdvanceRMB), 0);
  const totalPendingBalanceRMB = pos
    .filter((p) => p.balancePaymentStatus !== "PAID")
    .reduce((s, p) => s + (p.estBalanceRMB - p.paidBalanceRMB), 0);

  const today = new Date();
  const overdue = activePos.filter((p) => {
    const est = p.estArrivalDateAD;
    return est && new Date(est) < today && p.stage !== "RECEIVED";
  });

  const upcomingArrivals = activePos
    .filter((p) => p.estArrivalDateAD && new Date(p.estArrivalDateAD) >= today)
    .sort((a, b) => new Date(a.estArrivalDateAD!).getTime() - new Date(b.estArrivalDateAD!).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active POs" value={activePos.length.toString()} />
        <StatCard label="Vendors" value={vendors.toString()} />
        <StatCard label="Units In Transit" value={totalUnitsInTransit.toLocaleString()} />
        <StatCard label="Overdue Arrivals" value={overdue.length.toString()} highlight={overdue.length > 0} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Pending Advance Payments"
          value={`¥${totalPendingAdvanceRMB.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <StatCard
          label="Pending Balance Payments"
          value={`¥${totalPendingBalanceRMB.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
      </div>

      <SkuSearch />

      {overdue.length > 0 && (
        <div className="bg-white border border-red-200 rounded p-4">
          <h3 className="text-sm font-medium text-red-700 mb-2">Overdue Arrivals</h3>
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-1">PO No</th>
                <th className="py-1">Vendor</th>
                <th className="py-1">Est. Arrival</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-1">
                    <Link href={`/purchase-orders/${p.id}`} className="text-blue-600 hover:underline font-mono">
                      {p.poNumber}
                    </Link>
                  </td>
                  <td className="py-1">{p.vendor.name}</td>
                  <td className="py-1 text-red-600">{fmtDate(p.estArrivalDateAD)}</td>
                  <td className="py-1">{statusLabel(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white border rounded p-4">
        <h3 className="text-sm font-medium mb-2">Upcoming Arrivals</h3>
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-1">PO No</th>
              <th className="py-1">Vendor</th>
              <th className="py-1">Est. Arrival</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {upcomingArrivals.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-1">
                  <Link href={`/purchase-orders/${p.id}`} className="text-blue-600 hover:underline font-mono">
                    {p.poNumber}
                  </Link>
                </td>
                <td className="py-1">{p.vendor.name}</td>
                <td className="py-1">{fmtDate(p.estArrivalDateAD)}</td>
                <td className="py-1">{statusLabel(p)}</td>
              </tr>
            ))}
            {upcomingArrivals.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  No upcoming arrivals scheduled.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-white border rounded p-4 ${highlight ? "border-red-300" : ""}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}
