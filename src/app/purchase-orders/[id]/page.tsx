import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PODetailClient from "./PODetailClient";

export const dynamic = "force-dynamic";

async function getMasterNames(type: string) {
  const rows = await prisma.simpleMaster.findMany({
    where: { type: type as never },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => r.name);
}

export default async function PODetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [po, itemTypes, brands, frontMaterials, templeMaterials, lensMaterials, colors] =
    await Promise.all([
      prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          vendor: true,
          items: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { paymentDate: "asc" } },
          shipments: { orderBy: { shippingDate: "asc" } },
          attachments: { orderBy: { uploadedAt: "desc" } },
        },
      }),
      getMasterNames("ITEM_TYPE"),
      getMasterNames("BRAND"),
      getMasterNames("FRONT_MATERIAL"),
      getMasterNames("TEMPLE_MATERIAL"),
      getMasterNames("LENS_MATERIAL"),
      prisma.color.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
  if (!po) notFound();

  return (
    <PODetailClient
      po={JSON.parse(JSON.stringify(po))}
      itemTypes={itemTypes}
      brands={brands}
      frontMaterials={frontMaterials}
      templeMaterials={templeMaterials}
      lensMaterials={lensMaterials}
      colors={JSON.parse(JSON.stringify(colors))}
    />
  );
}
