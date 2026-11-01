import { NextRequest, NextResponse } from "next/server";
import { getApplicableForexRate } from "@/lib/forexRate";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const agentId = searchParams.get("agentId");

  if (!dateParam) return NextResponse.json(null);

  const rate = await getApplicableForexRate(agentId ?? null, new Date(dateParam));
  return NextResponse.json(rate === null ? null : { rate });
}
