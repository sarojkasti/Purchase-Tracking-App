import { NextRequest, NextResponse } from "next/server";
import { getApplicableFreightRates, getApplicablePaymentPolicy } from "@/lib/vendorPolicy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: vendorId } = await params;
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const orderDate = dateParam ? new Date(dateParam) : new Date();

  const [paymentPolicy, freightRates] = await Promise.all([
    getApplicablePaymentPolicy(vendorId, orderDate),
    getApplicableFreightRates(vendorId, orderDate),
  ]);

  return NextResponse.json({ paymentPolicy, freightRates });
}
