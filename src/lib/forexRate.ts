import { prisma } from "@/lib/prisma";

const FALLBACK_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function closestToDate<T extends { date: Date }>(rates: T[], date: Date): T | null {
  if (rates.length === 0) return null;
  return rates.reduce((closest, r) =>
    Math.abs(r.date.getTime() - date.getTime()) < Math.abs(closest.date.getTime() - date.getTime())
      ? r
      : closest
  );
}

// Resolves the RMB->NPR rate for a PO: prefers the PO's own agent's rate
// (latest on/before the date, within a 7-day window either side), falling
// back to whichever rate from any agent is closest to the date.
export async function getApplicableForexRate(agentId: string | null, date: Date) {
  if (agentId) {
    const windowStart = new Date(date.getTime() - FALLBACK_WINDOW_DAYS * MS_PER_DAY);
    const windowEnd = new Date(date.getTime() + FALLBACK_WINDOW_DAYS * MS_PER_DAY);
    const agentRates = await prisma.forexRate.findMany({
      where: { agentId, date: { gte: windowStart, lte: windowEnd } },
      orderBy: { date: "asc" },
    });
    let applicable: (typeof agentRates)[number] | null = null;
    for (const r of agentRates) {
      if (r.date <= date) applicable = r;
      else break;
    }
    if (!applicable) applicable = closestToDate(agentRates, date);
    if (applicable) return applicable.rate;
  }

  const allRates = await prisma.forexRate.findMany();
  const closest = closestToDate(allRates, date);
  return closest?.rate ?? null;
}
