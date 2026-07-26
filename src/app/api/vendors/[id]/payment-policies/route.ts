import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: vendorId } = await params;
  const policies = await prisma.vendorPaymentPolicy.findMany({
    where: { vendorId },
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json(policies);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: vendorId } = await params;
  const body = await req.json();
  const policy = await prisma.vendorPaymentPolicy.create({
    data: {
      vendorId,
      effectiveFrom: new Date(body.effectiveFrom),
      advancePercent: parseFloat(body.advancePercent) || 0,
      advanceOn: body.advanceOn || "Order",
      orderConfirmAfterAdv: !!body.orderConfirmAfterAdv,
      balancePercent: parseFloat(body.balancePercent) || 0,
      balanceFrom: body.balanceFrom || null,
      balanceAfterDays: body.balanceAfterDays ? parseInt(body.balanceAfterDays) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(policy, { status: 201 });
}
