export type PricingDriver = "rate" | "amount";

export type PricingFields = {
  unitsOrdered: string;
  rateRMB: string;
  amountRMB: string;
  pricingDriver: PricingDriver;
};

// Whichever of rate/amount the user edited last is the fixed value; the other is derived.
export function pricingAmount(row: PricingFields): number {
  if (row.pricingDriver === "amount") return parseFloat(row.amountRMB) || 0;
  return (parseFloat(row.unitsOrdered) || 0) * (parseFloat(row.rateRMB) || 0);
}

export function pricingRateText(row: PricingFields): string {
  if (row.pricingDriver === "rate") return row.rateRMB;
  const units = parseFloat(row.unitsOrdered) || 0;
  const amount = parseFloat(row.amountRMB) || 0;
  if (!units || !amount) return "";
  return String(Math.round((amount / units) * 10000) / 10000);
}

export function pricingAmountText(row: PricingFields): string {
  if (row.pricingDriver === "amount") return row.amountRMB;
  const amount = pricingAmount(row);
  return amount ? amount.toFixed(2) : "";
}
