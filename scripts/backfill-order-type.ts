import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Reset all so we recompute from scratch with correct logic
  await prisma.pOItem.updateMany({ data: { orderType: null } });

  const items = await prisma.pOItem.findMany({
    select: { id: true, poId: true, newmewSku: true, chineseSku: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${items.length} items without orderType`);

  // Track which SKUs we've seen as we process in creation order
  // so earlier POs correctly get "New Order" and later ones get "Reorder"
  const seenSkus = new Set<string>();

  let newCount = 0;
  let reorderCount = 0;

  for (const item of items) {
    const skuKey = item.newmewSku || item.chineseSku;

    // Check if this SKU already existed in an EARLIER PO item (already in DB before this item)
    let isReorder = false;
    if (item.newmewSku || item.chineseSku) {
      const earlier = await prisma.pOItem.findFirst({
        where: {
          id: { not: item.id },
          OR: [
            item.newmewSku ? { newmewSku: item.newmewSku } : {},
            item.chineseSku ? { chineseSku: item.chineseSku } : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
        orderBy: { createdAt: "asc" },
      });
      // Only a reorder if there's an EARLIER item with the same SKU
      isReorder = !!(earlier && earlier.createdAt < item.createdAt);
    }

    const orderType = isReorder ? "Reorder" : "New Order";
    await prisma.pOItem.update({ where: { id: item.id }, data: { orderType } });

    if (isReorder) reorderCount++;
    else newCount++;

    if (skuKey) seenSkus.add(skuKey);
    process.stdout.write(`\r  Processed: ${newCount + reorderCount}/${items.length}`);
  }

  console.log(`\nDone. New Order: ${newCount}, Reorder: ${reorderCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
