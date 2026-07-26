import { prisma } from "@/lib/prisma";

type ProductFields = {
  chineseSku?: string | null;
  newmewSku?: string | null;
  specificName?: string | null;
  itemType?: string | null;
  gender?: string | null;
  size?: string | null;
  front?: string | null;
  temple?: string | null;
  lens?: string | null;
  mrp?: number | null;
  imageUrl?: string | null;
};

// Remembers item details against the Chinese SKU so future items using the same
// SKU can auto-fill from it. Only writes fields that were actually provided.
export async function upsertProductFromItem(fields: ProductFields) {
  if (!fields.chineseSku) return;

  const data = {
    newmewSku: fields.newmewSku ?? undefined,
    specificName: fields.specificName ?? undefined,
    itemType: fields.itemType ?? undefined,
    gender: fields.gender ?? undefined,
    size: fields.size ?? undefined,
    front: fields.front ?? undefined,
    temple: fields.temple ?? undefined,
    lens: fields.lens ?? undefined,
    mrp: fields.mrp ?? undefined,
    imageUrl: fields.imageUrl ?? undefined,
  };

  await prisma.product.upsert({
    where: { chineseSku: fields.chineseSku },
    update: data,
    create: { chineseSku: fields.chineseSku, ...data },
  });
}
