import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const payments = await prisma.payment.findMany({
    orderBy: { paymentDate: "desc" },
    include: {
      po: { select: { poNumber: true, piNumber: true } },
      vendor: { select: { name: true, agent: { select: { name: true } } } },
      advices: { select: { id: true, fileName: true, url: true, mimeType: true } },
    },
  });

  const rows = payments.map((p) => ({
    id: p.id,
    poId: p.poId,
    paymentDate: p.paymentDate.toISOString(),
    poNumber: p.po.poNumber,
    piNumber: p.po.piNumber,
    vendor: p.vendor.name,
    agent: p.vendor.agent?.name ?? null,
    paymentType: p.paymentType,
    amountRMB: p.amountRMB,
    exchangeRate: p.exchangeRate,
    amountNPR: p.amountNPR,
    notes: p.notes,
    advices: p.advices,
  }));

  return NextResponse.json(rows);
}
