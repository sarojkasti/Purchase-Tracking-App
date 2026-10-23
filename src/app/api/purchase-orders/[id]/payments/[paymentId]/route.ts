import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPaymentRollups, poTotalAmountRMB } from "@/lib/poTotals";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { id: poId, paymentId } = await params;
  const body = await req.json();

  const existing = await prisma.payment.findFirst({ where: { id: paymentId, poId } });
  if (!existing) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const amountRMB = parseFloat(body.amountRMB) || 0;
  if (amountRMB <= 0) {
    return NextResponse.json({ error: "Payment amount must be greater than 0" }, { status: 400 });
  }
  const exchangeRate = parseFloat(body.exchangeRate) || 0;

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const totalRMB = poTotalAmountRMB(po);
  const otherPaymentsRMB = await prisma.payment.aggregate({
    where: { poId, id: { not: paymentId } },
    _sum: { amountRMB: true },
  });
  const alreadyPaidRMB = otherPaymentsRMB._sum.amountRMB ?? 0;
  if (totalRMB > 0 && alreadyPaidRMB + amountRMB > totalRMB) {
    return NextResponse.json(
      {
        error: `Payment of ¥${amountRMB.toLocaleString()} would bring total payments to ¥${(alreadyPaidRMB + amountRMB).toLocaleString()}, which exceeds the PO total of ¥${totalRMB.toLocaleString()}.`,
      },
      { status: 400 }
    );
  }

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      paymentDate: new Date(body.paymentDate),
      paymentType: body.paymentType,
      amountRMB,
      exchangeRate,
      amountNPR: amountRMB * exchangeRate,
      notes: body.notes || null,
    },
  });

  await syncPaymentRollups(poId);

  return NextResponse.json(payment);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { id: poId, paymentId } = await params;
  await prisma.payment.delete({ where: { id: paymentId } });

  await syncPaymentRollups(poId);

  return NextResponse.json({ ok: true });
}
