import { pricingAmount, type PricingFields } from "./itemPricing";

export type ItemFields = PricingFields & {
  chineseSku: string;
  specificName: string;
  itemType: string;
  brand: string;
  mfgType: string;
  front: string;
  temple: string;
  lens: string;
  colors: string[];
  sizeLens: string;
  sizeBridge: string;
  sizeTemple: string;
  imageUrl: string;
};

export type ItemFieldKey =
  | "chineseSku"
  | "itemType"
  | "brand"
  | "mfgType"
  | "front"
  | "temple"
  | "lens"
  | "colors"
  | "size"
  | "units"
  | "price";

const NONE: ReadonlySet<ItemFieldKey> = new Set();

// Everything on an item row is compulsory except Newmew SKU, Name and Image.
export function missingItemFields(row: ItemFields): Set<ItemFieldKey> {
  const missing = new Set<ItemFieldKey>();
  if (!row.chineseSku.trim()) missing.add("chineseSku");
  if (!row.itemType) missing.add("itemType");
  if (!row.brand) missing.add("brand");
  if (!row.mfgType) missing.add("mfgType");
  if (!row.front) missing.add("front");
  if (!row.temple) missing.add("temple");
  if (!row.lens) missing.add("lens");
  if (row.colors.length === 0) missing.add("colors");
  if (!row.sizeLens || !row.sizeBridge || !row.sizeTemple) missing.add("size");
  if ((parseFloat(row.unitsOrdered) || 0) <= 0) missing.add("units");
  if (pricingAmount(row) <= 0) missing.add("price");
  return missing;
}

// A brand-new row the user never typed into is ignored on save, so it is never flagged.
export function isRowInUse(row: ItemFields): boolean {
  return !!(row.chineseSku || row.specificName || row.unitsOrdered);
}

export function highlightedFields(
  row: ItemFields,
  showErrors: boolean,
  skip = false
): ReadonlySet<ItemFieldKey> {
  return showErrors && !skip ? missingItemFields(row) : NONE;
}

export function anyItemMissing(rows: ItemFields[]): boolean {
  return rows.some((r) => missingItemFields(r).size > 0);
}
