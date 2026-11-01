import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import SkuSearchBar from "./SkuSearchBar";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function stageLabel(row: { stage: string; onHold: boolean; cancelled: boolean }) {
  if (row.cancelled) return "Cancelled";
  if (row.onHold) return "On Hold";
  const MAP: Record<string, string> = {
    ORDER_PLACED: "Order Placed",
    START_PRODUCTION: "Production",
    PRINTING_PROCESS: "Printing",
    GOODS_COMPLETED: "Goods Ready",
    QC: "QC",
    READY_TO_SHIP: "Ready to Ship",
    SHIPPED: "Shipped",
    CUSTOM: "At Customs",
    RECEIVED: "Received",
  };
  return MAP[row.stage] ?? row.stage;
}

export default async function SkuHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string }>;
}) {
  const { sku } = await searchParams;

  let product = null;
  let items: Awaited<ReturnType<typeof fetchItems>> = [];

  if (sku) {
    [product, items] = await Promise.all([
      prisma.product.findUnique({
        where: { chineseSku: sku },
        select: { chineseSku: true, newmewSku: true, specificName: true, brand: true, imageUrl: true },
      }),
      fetchItems(sku),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">SKU History</h1>
        <Link href="/reports" className="text-sm text-gray-500 hover:text-gray-700">← Reports</Link>
      </div>

      <SkuSearchBar initialSku={sku ?? ""} />

      {sku && !product && (
        <div className="bg-white border rounded p-6 text-center text-gray-500 text-sm">
          No product found for SKU &ldquo;{sku}&rdquo;.
        </div>
      )}

      {product && (
        <div className="bg-white border rounded p-4 flex items-center gap-4">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="w-16 h-16 object-cover rounded border" />
          ) : (
            <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center text-gray-400 text-xs">No img</div>
          )}
          <div>
            <div className="font-semibold text-base">{product.chineseSku}</div>
            <div className="text-sm text-gray-600">
              {[product.newmewSku && `Newmew: ${product.newmewSku}`, product.specificName, product.brand]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div className="text-xs text-gray-400 mt-1">{items.length} PO{items.length !== 1 ? "s" : ""} found</div>
          </div>
        </div>
      )}

      {product && items.length === 0 && (
        <div className="bg-white border rounded p-6 text-center text-gray-500 text-sm">
          No PO history found for this SKU.
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-white border rounded overflow-x-auto">
          <table className="min-w-full text-xs border-separate border-spacing-0">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-3 py-2 font-medium border-b">Photo</th>
                <th className="px-3 py-2 font-medium border-b">PO No</th>
                <th className="px-3 py-2 font-medium border-b">Vendor</th>
                <th className="px-3 py-2 font-medium border-b">Order Date</th>
                <th className="px-3 py-2 font-medium border-b text-right">Ordered</th>
                <th className="px-3 py-2 font-medium border-b">Colors</th>
                <th className="px-3 py-2 font-medium border-b">Size</th>
                <th className="px-3 py-2 font-medium border-b text-right">Rate (RMB)</th>
                <th className="px-3 py-2 font-medium border-b">Ship Date</th>
                <th className="px-3 py-2 font-medium border-b text-right">Shipped</th>
                <th className="px-3 py-2 font-medium border-b">Arrival Date</th>
                <th className="px-3 py-2 font-medium border-b text-right">Received</th>
                <th className="px-3 py-2 font-medium border-b">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const totalShipped = row.shipments.reduce((s, sh) => s + sh.shippedQty, 0);
                const totalReceived = row.shipments.reduce((s, sh) => s + sh.receivedQty, 0);
                const firstShipment = row.shipments[0] ?? null;
                const latestArrival =
                  row.shipments
                    .map((sh) => sh.arrivalDate)
                    .filter(Boolean)
                    .sort()
                    .at(-1) ?? null;
                return (
                  <tr key={row.poId} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {row.imageUrl ? (
                        <img src={row.imageUrl} alt="" className="w-9 h-9 object-cover rounded" />
                      ) : (
                        <div className="w-9 h-9 bg-gray-100 rounded" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <Link href={`/purchase-orders/${row.poId}`} className="text-blue-600 hover:underline">
                        {row.poNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.vendor}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(row.orderDateAD)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.unitsOrdered}</td>
                    <td className="px-3 py-2">{row.colors.join(", ") || "—"}</td>
                    <td className="px-3 py-2">{row.size || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.amountRMB != null && row.unitsOrdered > 0
                        ? (row.amountRMB / row.unitsOrdered).toFixed(2)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {firstShipment ? fmtDate(firstShipment.shippingDate) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{totalShipped || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(latestArrival)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{totalReceived || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{stageLabel(row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function fetchItems(chineseSku: string) {
  const items = await prisma.pOItem.findMany({
    where: { chineseSku },
    include: {
      po: {
        select: {
          id: true,
          poNumber: true,
          orderDateAD: true,
          stage: true,
          onHold: true,
          cancelled: true,
          vendor: { select: { name: true } },
          shipments: {
            select: {
              shippingDate: true,
              arrivalDate: true,
              status: true,
              items: {
                where: { poItem: { chineseSku } },
                select: { shippedQty: true, receivedQty: true },
              },
            },
            orderBy: { shippingDate: "asc" },
          },
        },
      },
    },
    orderBy: { po: { orderDateAD: "desc" } },
  });

  return items.map((item) => ({
    poId: item.po.id,
    poNumber: item.po.poNumber,
    vendor: item.po.vendor.name,
    orderDateAD: item.po.orderDateAD,
    stage: item.po.stage,
    onHold: item.po.onHold,
    cancelled: item.po.cancelled,
    unitsOrdered: item.unitsOrdered,
    amountRMB: item.amountRMB,
    colors: item.colors,
    size: item.size,
    imageUrl: item.imageUrl,
    shipments: item.po.shipments.flatMap((sh) =>
      sh.items.map((si) => ({
        shippingDate: sh.shippingDate,
        arrivalDate: sh.arrivalDate,
        shippedQty: si.shippedQty,
        receivedQty: si.receivedQty,
        status: sh.status,
      }))
    ),
  }));
}
