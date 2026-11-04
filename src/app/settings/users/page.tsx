import UsersClient from "./UsersClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <UsersClient roles={roles} />;
}
