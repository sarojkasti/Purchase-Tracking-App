import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const KEYS = ["mail_tenant_id", "mail_client_id", "mail_client_secret", "mail_sender"] as const;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return false;
  // Allow any user whose role is "Admin" (case-insensitive)
  return session.user.roleName?.toLowerCase() === "admin";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.appSetting.findMany({ where: { key: { in: [...KEYS] } } });
  const config: Record<string, string> = {};
  for (const key of KEYS) {
    const row = rows.find((r) => r.key === key);
    // Never expose the secret value — return a placeholder if already set
    if (key === "mail_client_secret") {
      config[key] = row?.value ? "••••••••" : "";
    } else {
      config[key] = row?.value ?? "";
    }
  }
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  for (const key of KEYS) {
    const val: string = body[key] ?? "";
    // If the secret placeholder is sent unchanged, skip it
    if (key === "mail_client_secret" && val === "••••••••") continue;
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: val },
      update: { value: val },
    });
  }

  return NextResponse.json({ ok: true });
}
