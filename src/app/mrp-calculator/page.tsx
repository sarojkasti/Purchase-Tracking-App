import { prisma } from "@/lib/prisma";
import MrpCalculatorClient from "./MrpCalculatorClient";

export const dynamic = "force-dynamic";

// Read-only import of the existing Brand/Product Type masters, just so the
// calculator's dropdowns match spelling elsewhere in the app - the
// calculator itself otherwise stays fully standalone (see
// MrpCalculatorClient.tsx for why).
async function getMasterNames(type: string) {
  const rows = await prisma.simpleMaster.findMany({
    where: { type: type as never },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => r.name);
}

export default async function MrpCalculatorPage() {
  const [brands, productTypes] = await Promise.all([
    getMasterNames("BRAND"),
    getMasterNames("ITEM_TYPE"),
  ]);

  return <MrpCalculatorClient brands={brands} productTypes={productTypes} />;
}
