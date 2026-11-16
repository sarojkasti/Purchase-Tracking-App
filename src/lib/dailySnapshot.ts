import { prisma } from "@/lib/prisma";

async function takeSnapshotIfMissing(type: "MASTER" | "ITEMS", apiPath: string, baseUrl: string) {
  const today = new Date().toISOString().slice(0, 10);
  const label = `Daily – ${today}`;

  const existing = await prisma.reportSnapshot.findFirst({
    where: { type, label },
  });
  if (existing) return;

  try {
    const res = await fetch(`${baseUrl}${apiPath}`);
    if (!res.ok) return;
    const data = await res.json();
    await prisma.reportSnapshot.create({ data: { type, label, data, createdBy: null } });
    console.log(`[snapshot] saved ${type} snapshot for ${today}`);
  } catch (err) {
    console.error(`[snapshot] failed to save ${type} snapshot:`, err);
  }
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 0, 0);
  const ms = midnight.getTime() - now.getTime();
  // If 23:59 has already passed today, schedule for tomorrow
  return ms > 0 ? ms : ms + 24 * 60 * 60 * 1000;
}

export function scheduleDailySnapshots(baseUrl: string) {
  async function run() {
    await takeSnapshotIfMissing("MASTER", "/api/reports/purchase-orders", baseUrl);
    await takeSnapshotIfMissing("ITEMS", "/api/reports/items", baseUrl);
    // Schedule next run in 24 hours
    setTimeout(run, 24 * 60 * 60 * 1000);
  }

  // First run at 23:59 today (or tomorrow if already past)
  setTimeout(run, msUntilMidnight());
  console.log(`[snapshot] daily snapshot scheduled — first run in ${Math.round(msUntilMidnight() / 60000)} min`);
}
