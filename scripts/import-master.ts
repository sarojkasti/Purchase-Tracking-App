// One-off import of the "Master" sheet from the user's original Excel tracker
// (CHN PO V6.xlsx) into Vendor, SimpleMaster, and MrpRange.
// Run with: npx tsx scripts/import-master.ts "<path to xlsx>"

import "dotenv/config";
import XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";

type MasterType =
  | "BRAND"
  | "ITEM_TYPE"
  | "GENDER"
  | "MFG_TYPE"
  | "PRODUCTION_STATUS"
  | "FRONT_MATERIAL"
  | "TEMPLE_MATERIAL"
  | "LENS_MATERIAL"
  | "SHIPPING_METHOD"
  | "SHIPPING_STATUS_STAGE";

function collectColumn(rows: unknown[][], col: number, startRow: number): string[] {
  const seen: string[] = [];
  for (let i = startRow; i < rows.length; i++) {
    const v = rows[i]?.[col];
    if (typeof v === "string" && v.trim() && !seen.includes(v.trim())) {
      seen.push(v.trim());
    }
  }
  return seen;
}

async function importSimpleList(type: MasterType, names: string[]) {
  for (let i = 0; i < names.length; i++) {
    await prisma.simpleMaster.upsert({
      where: { type_name: { type: type as never, name: names[i] } },
      update: {},
      create: { type: type as never, name: names[i], sortOrder: i },
    });
  }
  console.log(`${type}: ${names.length} entries`);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-master.ts <path to xlsx>");
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Master"];
  if (!ws) {
    console.error('Sheet "Master" not found');
    process.exit(1);
  }
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // ---- Vendors (cols 0-8), data rows start at row 1 ----
  let vendorCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[0] ?? "").trim();
    const shortName = String(r[1] ?? "").trim();
    if (!name || !shortName) continue;

    const advancePercent = Number(r[3]) || 0;
    const advanceOn = String(r[4] ?? "").trim() || "Order";
    const orderConfirmAfterAdv = String(r[5] ?? "").trim().toLowerCase() === "yes";
    const balancePercent = Number(r[6]) || 0;
    const balanceFrom = String(r[7] ?? "").trim() || null;
    const afterDays = r[8] !== "" && r[8] !== undefined ? Number(r[8]) : null;

    const vendor = await prisma.vendor.upsert({
      where: { shortName },
      update: { name },
      create: { name, shortName },
    });

    await prisma.vendorPaymentPolicy.upsert({
      where: { vendorId_effectiveFrom: { vendorId: vendor.id, effectiveFrom: new Date(0) } },
      update: {
        advancePercent,
        advanceOn,
        orderConfirmAfterAdv,
        balancePercent,
        balanceFrom,
        balanceAfterDays: afterDays,
      },
      create: {
        vendorId: vendor.id,
        effectiveFrom: new Date(0),
        advancePercent,
        advanceOn,
        orderConfirmAfterAdv,
        balancePercent,
        balanceFrom,
        balanceAfterDays: afterDays,
      },
    });
    vendorCount++;
  }
  console.log(`Vendors: ${vendorCount} entries (+ initial payment policy each)`);

  // ---- Simple named-list masters ----
  await importSimpleList("BRAND", collectColumn(rows, 21, 1));
  await importSimpleList("ITEM_TYPE", collectColumn(rows, 24, 1));
  await importSimpleList("GENDER", collectColumn(rows, 27, 1));
  await importSimpleList("MFG_TYPE", collectColumn(rows, 29, 1));
  await importSimpleList("PRODUCTION_STATUS", collectColumn(rows, 31, 1));
  await importSimpleList("FRONT_MATERIAL", collectColumn(rows, 34, 1));
  await importSimpleList("TEMPLE_MATERIAL", collectColumn(rows, 35, 1));
  await importSimpleList("LENS_MATERIAL", collectColumn(rows, 36, 1));
  await importSimpleList("SHIPPING_METHOD", collectColumn(rows, 39, 1));
  await importSimpleList("SHIPPING_STATUS_STAGE", collectColumn(rows, 41, 1));

  // ---- MRP tiers (cols 47 Brand, 48 ItemType, 50 sortOrder-ish, 51 not used as label) ----
  // Label is the Price Range column (44), paired positionally with the MRP block.
  let mrpCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const brand = String(r[47] ?? "").trim();
    const itemType = String(r[48] ?? "").trim();
    const label = String(r[44] ?? "").trim();
    if (!brand || !itemType || !label) continue;
    await prisma.mrpRange.upsert({
      where: { brand_itemType_label: { brand, itemType, label } },
      update: {},
      create: { brand, itemType, label, sortOrder: mrpCount },
    });
    mrpCount++;
  }
  console.log(`MrpRange: ${mrpCount} entries`);

  // ---- Global Price Range list (col 44) also as its own reference, if any pages use it ----
  // Not modeled separately in schema (MrpRange is scoped per brand+itemType), so skipped.

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
