import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EmailConfigClient from "./EmailConfigClient";

export const dynamic = "force-dynamic";

export default async function EmailConfigPage() {
  const session = await auth();
  if (session?.user?.roleName?.toLowerCase() !== "admin") redirect("/settings");
  return <EmailConfigClient />;
}
