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
  { params }: { params: Promise<{ id: string; shipmentId: string }> }
) {
  const { id: poId, shipmentId } = await params;

  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, poId } });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Unsupported file type (allowed: JPG, PNG, WEBP, PDF)" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });

  const dir = path.join(process.cwd(), "public", "uploads", "shipment-attachments");
  await mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  const attachment = await prisma.shipmentAttachment.create({
    data: {
      shipmentId,
      fileName: file.name,
      url: `/uploads/shipment-attachments/${filename}`,
      mimeType: file.type,
      fileSize: file.size,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; shipmentId: string }> }
) {
  const { shipmentId } = await params;
  const attachmentId = new URL(req.url).searchParams.get("attachmentId");
  if (!attachmentId) return NextResponse.json({ error: "attachmentId required" }, { status: 400 });

  const att = await prisma.shipmentAttachment.findFirst({ where: { id: attachmentId, shipmentId } });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await unlink(path.join(process.cwd(), "public", att.url)).catch(() => null);
  await prisma.shipmentAttachment.delete({ where: { id: attachmentId } });

  return NextResponse.json({ ok: true });
}
