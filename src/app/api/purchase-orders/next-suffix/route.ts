import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PO numbers look like "{vendorShortName}-PO{major}.{minor}", e.g. "DTG-PO1.9".
// The sequence runs purely as a counter over (major, minor) pairs: 1.1, 1.2, ...,
// 1.9, 2.0, 2.1, ..., 2.9, 3.0, ... i.e. minor wraps 1-9 then 0-9 thereafter,
// bumping major each wrap.
function nextSuffix(existingSuffixes: string[]): string {
  let bestMajor = 0;
  let bestMinor = 0;
  for (const suffix of existingSuffixes) {
    const match = suffix.match(/^PO(\d+)\.(\d+)$/);
    if (!match) continue;
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    if (major > bestMajor || (major === bestMajor && minor > bestMinor)) {
      bestMajor = major;
      bestMinor = minor;
    }
  }

  if (bestMajor === 0 && bestMinor === 0) {
    return "PO1.1";
  }

  const minorCap = bestMajor === 1 ? 9 : 9;
  if (bestMinor >= minorCap) {
    return `PO${bestMajor + 1}.0`;
  }
  return `PO${bestMajor}.${bestMinor + 1}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendorId");
  if (!vendorId) {
    return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const pos = await prisma.purchaseOrder.findMany({
    where: { vendorId },
    select: { poNumber: true },
  });
  const prefix = `${vendor.shortName}-`;
  const existingSuffixes = pos
    .filter((p) => p.poNumber.startsWith(prefix))
    .map((p) => p.poNumber.slice(prefix.length));

  const suffix = nextSuffix(existingSuffixes);
  return NextResponse.json({ suffix, poNumber: `${prefix}${suffix}` });
}
