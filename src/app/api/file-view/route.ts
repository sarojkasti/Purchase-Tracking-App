import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(req: NextRequest) {
  const filePath = new URL(req.url).searchParams.get("path");
  if (!filePath) return new NextResponse("Missing path", { status: 400 });

  // Only allow files under /uploads/
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized.startsWith("/uploads/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const ext = normalized.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_MAP[ext];
  if (!mime) return new NextResponse("Unsupported type", { status: 400 });

  const abs = path.join(process.cwd(), "public", normalized);
  let buffer: Buffer;
  try {
    buffer = await readFile(abs);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": "inline",
    },
  });
}
