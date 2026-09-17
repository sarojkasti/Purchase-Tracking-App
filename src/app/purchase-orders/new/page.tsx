import { prisma } from "@/lib/prisma";
import NewPOForm from "./NewPOForm";

export const dynamic = "force-dynamic";

async function getMasterNames(type: string) {
  const rows = await prisma.simpleMaster.findMany({
    where: { type: type as never },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => r.name);
}

export default async function NewPOPage() {
  const [vendors, itemTypes, brands, frontMaterials, templeMaterials, lensMaterials, colors] =
    await Promise.all([
      prisma.vendor.findMany({ orderBy: { name: "asc" } }),
      getMasterNames("ITEM_TYPE"),
      getMasterNames("BRAND"),
      getMasterNames("FRONT_MATERIAL"),
      getMasterNames("TEMPLE_MATERIAL"),
      getMasterNames("LENS_MATERIAL"),
      prisma.color.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">New Purchase Order</h1>
      <NewPOForm
        vendors={vendors}
        itemTypes={itemTypes}
        brands={brands}
        frontMaterials={frontMaterials}
        templeMaterials={templeMaterials}
        lensMaterials={lensMaterials}
        colors={colors}
      />
    </div>
  );
}
