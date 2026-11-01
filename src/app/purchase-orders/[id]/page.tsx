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
  const [po, itemTypes, brands, genders, frontMaterials, templeMaterials, lensMaterials, colors, customPoints, agents] =
    await Promise.all([
      prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          vendor: { include: { agent: true } },
          agent: true,
          items: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { paymentDate: "asc" }, include: { advices: { orderBy: { uploadedAt: "asc" } } } },
          shipments: {
            orderBy: { shippingDate: "asc" },
            include: {
              items: { include: { receivingEvents: { orderBy: { receivedDate: "asc" } } } },
              attachments: { orderBy: { uploadedAt: "asc" } },
            },
          },
          attachments: { orderBy: { uploadedAt: "desc" } },
          stageEvents: { orderBy: { actualDate: "asc" } },
          poNotes: { orderBy: { createdAt: "desc" } },
          dateRevisions: { orderBy: { createdAt: "asc" } },
        },
      }),
      getMasterNames("ITEM_TYPE"),
      getMasterNames("BRAND"),
      getMasterNames("GENDER"),
      getMasterNames("FRONT_MATERIAL"),
      getMasterNames("TEMPLE_MATERIAL"),
      getMasterNames("LENS_MATERIAL"),
      prisma.color.findMany({ orderBy: { sortOrder: "asc" } }),
      getMasterNames("CUSTOM_POINT"),
      prisma.agent.findMany({ orderBy: { name: "asc" } }),
    ]);
  if (!po) notFound();

  return (
    <PODetailClient
      po={JSON.parse(JSON.stringify(po))}
      itemTypes={itemTypes}
      brands={brands}
      genders={genders}
      frontMaterials={frontMaterials}
      templeMaterials={templeMaterials}
      lensMaterials={lensMaterials}
      colors={JSON.parse(JSON.stringify(colors))}
      customPoints={customPoints}
      agents={JSON.parse(JSON.stringify(agents))}
    />
  );
}
