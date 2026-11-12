import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPaymentRollups, poTotalAmountRMB } from "@/lib/poTotals";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id: poId } = await params;
  const body = await req.json();

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const amountRMB = parseFloat(body.amountRMB) || 0;
  if (amountRMB <= 0) {
    return NextResponse.json({ error: "Payment amount must be greater than 0" }, { status: 400 });
  }
  const exchangeRate = parseFloat(body.exchangeRate) || 0;
  const amountNPR = body.amountNPR ? parseFloat(body.amountNPR) : amountRMB * exchangeRate;

  const totalRMB = poTotalAmountRMB(po);
  const existingPaidRMB = await prisma.payment.aggregate({
    where: { poId },
    _sum: { amountRMB: true },
  });
  const alreadyPaidRMB = existingPaidRMB._sum.amountRMB ?? 0;
  if (totalRMB > 0 && alreadyPaidRMB + amountRMB > totalRMB) {
    return NextResponse.json(
      {
        error: `Payment of ¥${amountRMB.toLocaleString()} would bring total payments to ¥${(alreadyPaidRMB + amountRMB).toLocaleString()}, which exceeds the PO total of ¥${totalRMB.toLocaleString()}.`,
      },
      { status: 400 }
    );
  }

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

  await syncPaymentRollups(poId);
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { poNumber: true } });
  await logAudit({ userId: session?.user?.id, userEmail: session?.user?.email ?? undefined, action: "CREATE", entity: "Payment", entityId: poId, detail: `PO ${po?.poNumber}: added ${payment.paymentType} payment ¥${payment.amountRMB}` });

  return NextResponse.json(payment, { status: 201 });
}
