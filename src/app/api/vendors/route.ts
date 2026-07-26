import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: { agent: true, _count: { select: { purchaseOrders: true } } },
  });
  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const vendor = await prisma.vendor.create({
    data: {
      name: body.name,
      shortName: body.shortName,
      address: body.address || null,
      agentId: body.agentId || null,
      remarks: body.remarks || null,
      paymentPolicies: {
        create: {
          effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
          advancePercent: parseFloat(body.advancePercent) || 0,
          advanceOn: body.advanceOn || "Order",
          orderConfirmAfterAdv: !!body.orderConfirmAfterAdv,
          balancePercent: parseFloat(body.balancePercent) || 0,
          balanceFrom: body.balanceFrom || null,
          balanceAfterDays: body.balanceAfterDays ? parseInt(body.balanceAfterDays) : null,
        },
      },
    },
  });
  return NextResponse.json(vendor, { status: 201 });
}
