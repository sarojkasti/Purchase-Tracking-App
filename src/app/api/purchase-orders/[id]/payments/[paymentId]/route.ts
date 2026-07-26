import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { id: poId, paymentId } = await params;
  await prisma.payment.delete({ where: { id: paymentId } });

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  const payments = await prisma.payment.findMany({ where: { poId } });
  const paidAdvanceRMB = payments
    .filter((p) => p.paymentType === "ADVANCE")
    .reduce((s, p) => s + p.amountRMB, 0);
  const paidAdvanceNPR = payments
    .filter((p) => p.paymentType === "ADVANCE")
    .reduce((s, p) => s + p.amountNPR, 0);
  const paidBalanceRMB = payments
    .filter((p) => p.paymentType === "BALANCE")
    .reduce((s, p) => s + p.amountRMB, 0);
  const paidBalanceNPR = payments
    .filter((p) => p.paymentType === "BALANCE")
    .reduce((s, p) => s + p.amountNPR, 0);

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      paidAdvanceRMB,
      paidAdvanceNPR,
      advancePaymentStatus:
        paidAdvanceRMB <= 0 ? "PENDING" : paidAdvanceRMB < (po?.estAdvanceRMB ?? 0) ? "PARTIAL" : "PAID",
      paidBalanceRMB,
      paidBalanceNPR,
      balancePaymentStatus:
        paidBalanceRMB <= 0 ? "PENDING" : paidBalanceRMB < (po?.estBalanceRMB ?? 0) ? "PARTIAL" : "PAID",
    },
  });

  return NextResponse.json({ ok: true });
}
