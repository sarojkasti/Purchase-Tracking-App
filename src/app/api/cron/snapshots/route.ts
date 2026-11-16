import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by an external scheduler (e.g. Windows Task Scheduler, cron) once daily.
// Protect with a secret: POST /api/cron/snapshots
// Header: Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const label = `Daily – ${new Date().toISOString().slice(0, 10)}`;
  const baseUrl = process.env.NEXTAUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

  const [masterRes, itemsRes] = await Promise.all([
    fetch(`${baseUrl}/api/reports/purchase-orders`, { headers: { Cookie: "" } }),
    fetch(`${baseUrl}/api/reports/items`, { headers: { Cookie: "" } }),
  ]);

  const errors: string[] = [];
  const created: string[] = [];

  if (masterRes.ok) {
    const data = await masterRes.json();
    await prisma.reportSnapshot.create({ data: { type: "MASTER", label, data, createdBy: null } });
    created.push("MASTER");
  } else {
    errors.push(`MASTER: ${masterRes.status}`);
  }

  if (itemsRes.ok) {
    const data = await itemsRes.json();
    await prisma.reportSnapshot.create({ data: { type: "ITEMS", label, data, createdBy: null } });
    created.push("ITEMS");
  } else {
    errors.push(`ITEMS: ${itemsRes.status}`);
  }

  return NextResponse.json({ created, errors });
}
