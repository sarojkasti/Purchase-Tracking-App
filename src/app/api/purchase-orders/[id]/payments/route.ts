import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params;
  const body = await req.json();

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const amountRMB = parseFloat(body.amountRMB) || 0;
  const exchangeRate = parseFloat(body.exchangeRate) || 0;
  const amountNPR = body.amountNPR ? parseFloat(body.amountNPR) : amountRMB * exchangeRate;

  const payment = await prisma.payment.create({
    data: {
      poId,
      vendorId: po.vendorId,
      paymentDate: new Date(body.paymentDate),
      paymentType: body.paymentType,
      amountRMB,
      exchangeRate,
      amountNPR,
      sunglassesNPR: body.sunglassesNPR ? parseFloat(body.sunglassesNPR) : null,
      framesNPR: body.framesNPR ? parseFloat(body.framesNPR) : null,
      clipOnNPR: body.clipOnNPR ? parseFloat(body.clipOnNPR) : null,
      kidsNPR: body.kidsNPR ? parseFloat(body.kidsNPR) : null,
      lensNPR: body.lensNPR ? parseFloat(body.lensNPR) : null,
      notes: body.notes || null,
    },
  });

  // Roll up paid totals onto the PO
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
        paidAdvanceRMB <= 0 ? "PENDING" : paidAdvanceRMB < po.estAdvanceRMB ? "PARTIAL" : "PAID",
      paidBalanceRMB,
      paidBalanceNPR,
      balancePaymentStatus:
        paidBalanceRMB <= 0 ? "PENDING" : paidBalanceRMB < po.estBalanceRMB ? "PARTIAL" : "PAID",
    },
  });

  return NextResponse.json(payment, { status: 201 });
}
