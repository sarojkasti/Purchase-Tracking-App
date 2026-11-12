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

  try {
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
  } catch (err) {
    console.error("email-config GET error:", err);
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
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
  } catch (err) {
    console.error("email-config POST error:", err);
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
