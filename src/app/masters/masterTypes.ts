export const masterTypes = [
  { type: "BRAND", label: "Brands", description: "Your own brand names (Newmew, Limitless, etc.)" },
  { type: "ITEM_TYPE", label: "Item Types", description: "Sunglasses, Frames, Clip On, Kids, Lens" },
  { type: "GENDER", label: "Gender", description: "Unisex, Men, Women, Child" },
  { type: "MFG_TYPE", label: "Manufacturing Types", description: "Ready Goods vs Production" },
  {
    type: "PRODUCTION_STATUS",
    label: "Production Status Stages",
    description: "Order Placed → Start Production → ... → Shipped",
  },
  { type: "FRONT_MATERIAL", label: "Front Materials", description: "Frame front material options" },
  { type: "TEMPLE_MATERIAL", label: "Temple Materials", description: "Frame temple material options" },
  { type: "LENS_MATERIAL", label: "Lens Materials", description: "Lens material options" },
  { type: "SHIPPING_METHOD", label: "Shipping Methods", description: "Road, Airway" },
  {
    type: "SHIPPING_STATUS_STAGE",
    label: "Shipping Status Stages",
    description: "Hold, Dispatched, Custom Reached, Custom Cleared, Received...",
  },
] as const;

export type MasterTypeKey = (typeof masterTypes)[number]["type"];
