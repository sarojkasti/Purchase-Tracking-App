import { prisma } from "@/lib/prisma";

// Picks the payment policy in effect for a given PO order date:
// the latest policy whose effectiveFrom <= orderDate, or the earliest
// policy at all if the order date predates every recorded policy.
export async function getApplicablePaymentPolicy(vendorId: string, orderDate: Date) {
  const policies = await prisma.vendorPaymentPolicy.findMany({
    where: { vendorId },
    orderBy: { effectiveFrom: "asc" },
  });
  if (policies.length === 0) return null;

  let applicable = policies[0];
  for (const p of policies) {
    if (p.effectiveFrom <= orderDate) {
      applicable = p;
    } else {
      break;
    }
  }
  return applicable;
}

// Freight rates are owned by the Agent, not the Vendor - looks up the vendor's
// assigned agent, then resolves that agent's rates as of the given order date.
export async function getApplicableFreightRates(vendorId: string, orderDate: Date) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor?.agentId) return [];

  const rates = await prisma.agentFreightRatePolicy.findMany({
    where: { agentId: vendor.agentId },
    orderBy: { effectiveFrom: "asc" },
  });
  if (rates.length === 0) return [];

  // For each (category, mode) pair, pick the latest rate effective on/before
  // orderDate, falling back to the earliest recorded rate for that pair.
  const byKey = new Map<string, typeof rates>();
  for (const r of rates) {
    const key = `${r.itemCategory}|${r.transportMode}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }

  const result: (typeof rates)[number][] = [];
  for (const group of byKey.values()) {
    let applicable = group[0];
    for (const r of group) {
      if (r.effectiveFrom <= orderDate) {
        applicable = r;
      } else {
        break;
      }
    }
    result.push(applicable);
  }
  return result;
}
