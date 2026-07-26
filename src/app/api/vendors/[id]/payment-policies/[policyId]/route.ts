import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  const { policyId } = await params;
  const body = await req.json();
  const policy = await prisma.vendorPaymentPolicy.update({
    where: { id: policyId },
    data: {
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      advancePercent: body.advancePercent !== undefined ? parseFloat(body.advancePercent) : undefined,
      advanceOn: body.advanceOn,
      orderConfirmAfterAdv: body.orderConfirmAfterAdv,
      balancePercent: body.balancePercent !== undefined ? parseFloat(body.balancePercent) : undefined,
      balanceFrom: body.balanceFrom,
      balanceAfterDays: body.balanceAfterDays ? parseInt(body.balanceAfterDays) : undefined,
      notes: body.notes,
    },
  });
  return NextResponse.json(policy);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  const { policyId } = await params;
  await prisma.vendorPaymentPolicy.delete({ where: { id: policyId } });
  return NextResponse.json({ ok: true });
}
