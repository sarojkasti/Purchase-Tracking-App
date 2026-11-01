import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { id: poId, paymentId } = await params;

  const payment = await prisma.payment.findFirst({ where: { id: paymentId, poId } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type (allowed: JPG, PNG, WEBP, PDF)" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "uploads", "payment-advice");
  await mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  const advice = await prisma.paymentAdvice.create({
    data: {
      paymentId,
      fileName: file.name,
      url: `/uploads/payment-advice/${filename}`,
      mimeType: file.type,
      fileSize: file.size,
    },
  });

  return NextResponse.json(advice, { status: 201 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { paymentId } = await params;
  const url = new URL(_req.url);
  const adviceId = url.searchParams.get("adviceId");
  if (!adviceId) return NextResponse.json({ error: "adviceId required" }, { status: 400 });

  const advice = await prisma.paymentAdvice.findFirst({ where: { id: adviceId, paymentId } });
  if (!advice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = path.join(process.cwd(), "public", advice.url);
  await unlink(filePath).catch(() => null);

  await prisma.paymentAdvice.delete({ where: { id: adviceId } });

  return NextResponse.json({ ok: true });
}
