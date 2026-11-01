export const masterTypes = [
  { type: "BRAND", label: "Brands", description: "Your own brand names (Newmew, Limitless, etc.)" },
  { type: "ITEM_TYPE", label: "Item Types", description: "Sunglasses, Frames, Clip On, Kids, Lens" },
  { type: "GENDER", label: "Gender", description: "Unisex, Men, Women, Child" },
  { type: "MFG_TYPE", label: "Manufacturing Types", description: "Ready Goods vs Production" },
  { type: "FRONT_MATERIAL", label: "Front Materials", description: "Frame front material options" },
  { type: "TEMPLE_MATERIAL", label: "Temple Materials", description: "Frame temple material options" },
  { type: "LENS_MATERIAL", label: "Lens Materials", description: "Lens material options" },
  { type: "CUSTOM_POINT", label: "Custom Points", description: "Customs checkpoints through which goods are imported (e.g. Birgunj, Bhairahawa)" },
] as const;

export type MasterTypeKey = (typeof masterTypes)[number]["type"];
