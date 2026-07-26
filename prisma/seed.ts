import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

const agentNames = ["Agent", "Bhupal", "Rajin", "AYM", "ARR"];

const simpleMasters: Record<string, string[]> = {
  BRAND: ["Newmew", "Limitless", "Other"],
  ITEM_TYPE: ["Sunglasses", "Frames", "Clip On", "Kids", "Lens"],
  GENDER: ["Unisex", "Child", "Women", "Men"],
  MFG_TYPE: ["Ready Goods", "Production"],
  PRODUCTION_STATUS: [
    "Order Placed",
    "Start Production",
    "Printing Process",
    "Goods Completed",
    "QC",
    "Ready to Shipped",
    "Shipped",
  ],
  FRONT_MATERIAL: ["PC", "Metal", "TR", "Acetate", "Wooden"],
  TEMPLE_MATERIAL: ["CP", "Metal", "TR", "Acetate", "Wooden"],
  LENS_MATERIAL: ["TAC", "PC", "Nylon", "Deko", "AC", "Nylon Polarized", "PC Polarized"],
  SHIPPING_METHOD: ["Road", "Airway"],
  SHIPPING_STATUS_STAGE: [
    "Hold",
    "Dispatched",
    "Custom Reached",
    "Custom Cleared",
    "Received",
    "Shipped",
    "Custom",
  ],
};

// Each Brand + Item Type combo keeps its own MRP price range list.
const mrpRangeGroups: { brand: string; itemType: string; labels: string[] }[] = [
  { brand: "Newmew", itemType: "Sunglasses", labels: ["1100-1300", "1301-1600", "1601-2200", "2201-2500"] },
  { brand: "Newmew", itemType: "Frames", labels: ["1301-1600", "1601-2200"] },
  { brand: "Newmew", itemType: "Clip On", labels: ["2501-2900", "2901 and above"] },
  { brand: "Limitless", itemType: "Sunglasses", labels: ["1500-1700", "1701-1900", "1901-2500", "2501-2900"] },
  { brand: "Limitless", itemType: "Frames", labels: ["1301-1600", "1601-2200"] },
  { brand: "Limitless", itemType: "Clip On", labels: ["2600-2800", "2801-3200"] },
];

const vendors = [
  { name: "Guans Glasses", shortName: "GSP", advancePercent: 0.3, advanceOn: "Order", orderConfirmAfterAdv: true, balancePercent: 0.7, balanceFrom: null, balanceAfterDays: null, agentName: "Agent" },
  { name: "Dongtain", shortName: "DTG", advancePercent: 0.3, advanceOn: "Order", orderConfirmAfterAdv: true, balancePercent: 0.7, balanceFrom: "Shipping", balanceAfterDays: 90, agentName: "Bhupal" },
  { name: "Jiusheng", shortName: "JSG", advancePercent: 0.4, advanceOn: "Shipping", orderConfirmAfterAdv: false, balancePercent: 0.6, balanceFrom: "Shipping", balanceAfterDays: 90, agentName: "Rajin" },
  { name: "Kanjing Optical", shortName: "KJO", advancePercent: 0.15, advanceOn: "Order", orderConfirmAfterAdv: true, balancePercent: 0.85, balanceFrom: "Shipping", balanceAfterDays: 90, agentName: "AYM" },
  { name: "JDX/JDS", shortName: "JDX", advancePercent: 0.4, advanceOn: "Order", orderConfirmAfterAdv: true, balancePercent: 0.6, balanceFrom: "Shipping", balanceAfterDays: 45, agentName: "ARR" },
  { name: "Jimbo", shortName: "JIM", advancePercent: 0.2, advanceOn: "Order", orderConfirmAfterAdv: true, balancePercent: 0.8, balanceFrom: null, balanceAfterDays: null, agentName: null },
  { name: "Xinyuan JULONG", shortName: "XYJ", advancePercent: 0.4, advanceOn: "Shipping", orderConfirmAfterAdv: false, balancePercent: 0.6, balanceFrom: "Shipping", balanceAfterDays: 45, agentName: "Bhupal" },
  { name: "Looksee", shortName: "LSK", advancePercent: 0.5, advanceOn: "Shipping", orderConfirmAfterAdv: false, balancePercent: 0.5, balanceFrom: "Shipping", balanceAfterDays: 60, agentName: "Bhupal" },
  { name: "FS Optical", shortName: "FSO", advancePercent: 0, advanceOn: "Order", orderConfirmAfterAdv: false, balancePercent: 1, balanceFrom: "Shipping", balanceAfterDays: 60, agentName: "Bhupal" },
  { name: "Zhanshang", shortName: "ZAN", advancePercent: 0.15, advanceOn: "Order", orderConfirmAfterAdv: true, balancePercent: 0.85, balanceFrom: "Shipping", balanceAfterDays: 90, agentName: "Bhupal" },
  { name: "Euro Monk", shortName: "EMK", advancePercent: 0.15, advanceOn: "Order", orderConfirmAfterAdv: true, balancePercent: 0.85, balanceFrom: "Shipping", balanceAfterDays: 90, agentName: "Bhupal" },
  { name: "FS Optical (Old)", shortName: "FSO Old", advancePercent: 0.4, advanceOn: "Shipping", orderConfirmAfterAdv: false, balancePercent: 0.6, balanceFrom: "Shipping", balanceAfterDays: 60, agentName: "Bhupal" },
  { name: "Xinchuang", shortName: "CCG", advancePercent: 0.1, advanceOn: "Order", orderConfirmAfterAdv: true, balancePercent: 0.9, balanceFrom: null, balanceAfterDays: null, agentName: "Bhupal" },
  { name: "Amrit", shortName: "ARR", advancePercent: 0, advanceOn: "Order", orderConfirmAfterAdv: false, balancePercent: 1, balanceFrom: "Shipping", balanceAfterDays: 90, agentName: "Bhupal" },
  { name: "AYM", shortName: "AYM", advancePercent: 0, advanceOn: "Order", orderConfirmAfterAdv: false, balancePercent: 1, balanceFrom: "Shipping", balanceAfterDays: 90, agentName: "Rajin" },
];

// Agent name -> freight rate by category & mode, from Master sheet cols M-T
// (the sheet's rate columns are keyed by agent, e.g. "BhupalSunglassesRoad")
const agentFreightRates: Record<string, { category: string; mode: string; rate: number }[]> = {
  Agent: [
    { category: "Sunglasses", mode: "Road", rate: 220 },
    { category: "Frames", mode: "Road", rate: 155 },
    { category: "Clip On", mode: "Road", rate: 300 },
    { category: "Kids", mode: "Road", rate: 150 },
    { category: "Sunglasses", mode: "Airway", rate: 260 },
    { category: "Frames", mode: "Airway", rate: 175 },
    { category: "Clip On", mode: "Airway", rate: 330 },
    { category: "Kids", mode: "Airway", rate: 185 },
  ],
  Bhupal: [
    { category: "Sunglasses", mode: "Road", rate: 220 },
    { category: "Frames", mode: "Road", rate: 155 },
    { category: "Clip On", mode: "Road", rate: 300 },
    { category: "Kids", mode: "Road", rate: 150 },
    { category: "Sunglasses", mode: "Airway", rate: 260 },
    { category: "Frames", mode: "Airway", rate: 175 },
    { category: "Clip On", mode: "Airway", rate: 330 },
    { category: "Kids", mode: "Airway", rate: 185 },
  ],
  Rajin: [
    { category: "Sunglasses", mode: "Road", rate: 230 },
    { category: "Frames", mode: "Road", rate: 170 },
    { category: "Clip On", mode: "Road", rate: 330 },
    { category: "Kids", mode: "Road", rate: 180 },
    { category: "Sunglasses", mode: "Airway", rate: 255 },
    { category: "Frames", mode: "Airway", rate: 195 },
    { category: "Clip On", mode: "Airway", rate: 355 },
    { category: "Kids", mode: "Airway", rate: 205 },
  ],
};

async function main() {
  console.log("Seeding masters...");

  for (const [type, names] of Object.entries(simpleMasters)) {
    for (let i = 0; i < names.length; i++) {
      await prisma.simpleMaster.upsert({
        where: { type_name: { type: type as never, name: names[i] } },
        update: {},
        create: { type: type as never, name: names[i], sortOrder: i },
      });
    }
  }

  for (const group of mrpRangeGroups) {
    for (let i = 0; i < group.labels.length; i++) {
      await prisma.mrpRange.upsert({
        where: {
          brand_itemType_label: { brand: group.brand, itemType: group.itemType, label: group.labels[i] },
        },
        update: { sortOrder: i },
        create: { brand: group.brand, itemType: group.itemType, label: group.labels[i], sortOrder: i },
      });
    }
  }

  // All seeded policy data reflects the terms as recorded in the original
  // sheet; treat that as effective from the beginning of time so it covers all
  // historical POs by default.
  const seedEffectiveFrom = new Date("2000-01-01");

  const agentIdByName = new Map<string, string>();
  for (const name of agentNames) {
    const agent = await prisma.agent.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    agentIdByName.set(name, agent.id);

    const rates = agentFreightRates[name];
    if (rates) {
      for (const r of rates) {
        await prisma.agentFreightRatePolicy.upsert({
          where: {
            agentId_effectiveFrom_itemCategory_transportMode: {
              agentId: agent.id,
              effectiveFrom: seedEffectiveFrom,
              itemCategory: r.category,
              transportMode: r.mode,
            },
          },
          update: { rate: r.rate },
          create: {
            agentId: agent.id,
            effectiveFrom: seedEffectiveFrom,
            itemCategory: r.category,
            transportMode: r.mode,
            rate: r.rate,
          },
        });
      }
    }
  }

  // Sample forex history, from the original sheet's Forex tab, attributed to
  // the first agent (agents may record their own rate on the same date).
  const seedForexAgentId = agentIdByName.get(agentNames[0])!;
  const forexRates = [
    { date: "2000-01-01", rate: 20 },
    { date: "2026-03-13", rate: 22.2 },
    { date: "2026-03-20", rate: 22.2 },
    { date: "2026-04-08", rate: 23 },
  ];
  for (const f of forexRates) {
    await prisma.forexRate.upsert({
      where: { agentId_date: { agentId: seedForexAgentId, date: new Date(f.date) } },
      update: { rate: f.rate },
      create: { agentId: seedForexAgentId, date: new Date(f.date), rate: f.rate },
    });
  }

  for (const v of vendors) {
    const { advancePercent, advanceOn, orderConfirmAfterAdv, balancePercent, balanceFrom, balanceAfterDays, agentName, ...identity } = v;
    const agentId = agentName ? agentIdByName.get(agentName) ?? null : null;

    const vendor = await prisma.vendor.upsert({
      where: { shortName: v.shortName },
      update: { ...identity, agentId },
      create: { ...identity, agentId },
    });

    await prisma.vendorPaymentPolicy.upsert({
      where: { vendorId_effectiveFrom: { vendorId: vendor.id, effectiveFrom: seedEffectiveFrom } },
      update: { advancePercent, advanceOn, orderConfirmAfterAdv, balancePercent, balanceFrom, balanceAfterDays },
      create: {
        vendorId: vendor.id,
        effectiveFrom: seedEffectiveFrom,
        advancePercent,
        advanceOn,
        orderConfirmAfterAdv,
        balancePercent,
        balanceFrom,
        balanceAfterDays,
      },
    });
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
