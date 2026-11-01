import { prisma } from "@/lib/prisma";

// Returns the exchange rate from the most recent payment on or before `date`,
// preferring payments from the given agent's vendors. Falls back to the nearest
// payment from any vendor if none is found.
export async function getApplicableForexRate(agentId: string | null, date: Date): Promise<number | null> {
  // Prefer the most recent payment on or before the date for the same agent's vendors.
  if (agentId) {
    const before = await prisma.payment.findFirst({
      where: { vendor: { agentId }, paymentDate: { lte: date } },
      orderBy: { paymentDate: "desc" },
    });
    if (before) return before.exchangeRate;

    // Nothing on or before — take the nearest payment after the date instead.
    const after = await prisma.payment.findFirst({
      where: { vendor: { agentId }, paymentDate: { gt: date } },
      orderBy: { paymentDate: "asc" },
    });
    if (after) return after.exchangeRate;
  }

  // Global fallback: nearest payment to the date from any vendor.
  const [before, after] = await Promise.all([
    prisma.payment.findFirst({ where: { paymentDate: { lte: date } }, orderBy: { paymentDate: "desc" } }),
    prisma.payment.findFirst({ where: { paymentDate: { gt: date } }, orderBy: { paymentDate: "asc" } }),
  ]);

  if (before && after) {
    const diffBefore = date.getTime() - before.paymentDate.getTime();
    const diffAfter = after.paymentDate.getTime() - date.getTime();
    return diffBefore <= diffAfter ? before.exchangeRate : after.exchangeRate;
  }
  return before?.exchangeRate ?? after?.exchangeRate ?? null;
}
