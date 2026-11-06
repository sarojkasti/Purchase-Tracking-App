import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Users seen in last 5 minutes are considered online
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      lastSeenAt: true,
      role: { select: { name: true } },
    },
    orderBy: { lastSeenAt: { sort: "desc", nulls: "last" } },
  });

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      online: u.lastSeenAt ? u.lastSeenAt >= threshold : false,
    }))
  );
}
