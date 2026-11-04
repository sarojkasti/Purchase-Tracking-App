/**
 * Creates the first admin user and an Admin role with all permissions.
 * Run once: npx tsx scripts/seed-admin.ts
 */
import { config } from "dotenv";
config({ path: "../.env" });
import { PrismaClient } from "../src/generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ALL_PERMISSIONS = {
  dashboard: true,
  pos_view: true,
  pos_create: true,
  pos_edit: true,
  pos_delete: true,
  reports: true,
  vendors: true,
  masters: true,
  settings: true,
};

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: { permissions: ALL_PERMISSIONS },
    create: { name: "Admin", permissions: ALL_PERMISSIONS },
  });
  console.log("✓ Admin role:", adminRole.id);

  const email = "itdepartment@newmew.com";
  const password = "Admin@1234"; // change after first login
  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { roleId: adminRole.id, active: true },
    create: { name: "IT Department", email, password: hashed, roleId: adminRole.id, active: true },
  });
  console.log("✓ Admin user:", user.email);
  console.log("\nLogin with:");
  console.log("  Email:   ", email);
  console.log("  Password:", password);
  console.log("\nChange the password after first login!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
