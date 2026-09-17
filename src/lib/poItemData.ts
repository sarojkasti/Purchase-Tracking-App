import { Prisma } from "@/generated/prisma/client";

// Shared field-mapping logic for creating/updating a POItem from a raw form body.
export function buildPOItemData(body: Record<string, unknown>): Prisma.POItemUncheckedCreateInput {
  const front = (body.front as string) || null;
  const temple = (body.temple as string) || null;
  const lens = (body.lens as string) || null;
  const category =
    (body.category as string) || [front, temple, lens].filter(Boolean).join("+") || null;

  return {
    poId: "", // overwritten by caller for create; ignored for update
    chineseSku: (body.chineseSku as string) || null,
    newmewSku: (body.newmewSku as string) || null,
    orderType: (body.orderType as string) || null,
    specificName: (body.specificName as string) || null,
    itemType: (body.itemType as string) || null,
    mfgType: (body.mfgType as never) || null,
    brand: (body.brand as string) || null,
    category,
    gender: (body.gender as string) || null,
    size: (body.size as string) || null,
    front,
    temple,
    lens,
    colors: Array.isArray(body.colors) ? (body.colors as string[]) : [],
    imageUrl: (body.imageUrl as string) || null,
    mrp: body.mrp ? parseFloat(body.mrp as string) : null,
    priceRangeLabel: (body.priceRangeLabel as string) || null,
    unitsOrdered: parseInt(body.unitsOrdered as string) || 0,
    shippedQty: parseInt(body.shippedQty as string) || 0,
    receivedQty: parseInt(body.receivedQty as string) || 0,
    materialCost: body.materialCost ? parseFloat(body.materialCost as string) : null,
    printingCost: body.printingCost ? parseFloat(body.printingCost as string) : null,
    freightCost: body.freightCost ? parseFloat(body.freightCost as string) : null,
    amountRMB: body.amountRMB ? parseFloat(body.amountRMB as string) : null,
    convRate: body.convRate ? parseFloat(body.convRate as string) : null,
    amountNPR: body.amountNPR ? parseFloat(body.amountNPR as string) : null,
    estCustomNPR: body.estCustomNPR ? parseFloat(body.estCustomNPR as string) : null,
    estArrivalDate: body.estArrivalDate ? new Date(body.estArrivalDate as string) : null,
    goodsStatus: (body.goodsStatus as string) || null,
  };
}
