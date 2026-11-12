import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendMail } from "@/lib/graphMail";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.roleName?.toLowerCase() !== "admin") return null;
  return session.user;
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let to: string;
  try {
    const body = await req.json();
    to = body.to?.trim();
    if (!to) throw new Error("missing");
  } catch {
    return NextResponse.json({ error: "Provide a 'to' email address." }, { status: 400 });
  }

  try {
    await sendMail({
      to,
      subject: "Test Email – Purchase Tracking App",
      html: "<p>This is a test email from the Purchase Tracking App. Microsoft Graph API is working correctly.</p>",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
