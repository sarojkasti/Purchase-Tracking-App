import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: {
      agent: true,
      _count: { select: { purchaseOrders: true } },
      paymentPolicies: { orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Vendors</h1>
        <Link
          href="/vendors/new"
          className="rounded bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-gray-700"
        >
          + New Vendor
        </Link>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Short Name</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Current Advance %</th>
              <th className="px-3 py-2">Current Balance %</th>
              <th className="px-3 py-2"># POs</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => {
              const current = v.paymentPolicies[0];
              return (
                <tr key={v.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{v.name}</td>
                  <td className="px-3 py-2 font-mono">{v.shortName}</td>
                  <td className="px-3 py-2">{v.agent?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    {current ? `${(current.advancePercent * 100).toFixed(0)}%` : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {current ? `${(current.balancePercent * 100).toFixed(0)}%` : "-"}
                  </td>
                  <td className="px-3 py-2">{v._count.purchaseOrders}</td>
                  <td className="px-3 py-2">
                    <Link href={`/vendors/${v.id}`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
