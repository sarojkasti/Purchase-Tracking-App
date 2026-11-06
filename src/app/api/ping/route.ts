import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUserLastSeen } from "@/lib/audit";

export async function POST() {
  const session = await auth();
  if (session?.user?.id) {
    await updateUserLastSeen(session.user.id);
  }
  return NextResponse.json({ ok: true });
}
