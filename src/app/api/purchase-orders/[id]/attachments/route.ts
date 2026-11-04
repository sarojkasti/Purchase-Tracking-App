import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { uploadToOneDrive, isOneDriveConfigured } from "@/lib/onedrive";

const EXCEL_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const VALID_TYPES = ["PI", "CI", "COSTING_SHEET", "OTHER"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attachments = await prisma.pOAttachment.findMany({
    where: { poId: id },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json(attachments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file");
  const type = String(form.get("type") || "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid attachment type" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let fileUrl: string;

  if (EXCEL_TYPES.has(file.type) && isOneDriveConfigured()) {
    // Upload Excel files to OneDrive and get a shareable link
    const uniqueName = `${crypto.randomUUID()}-${file.name}`;
    fileUrl = await uploadToOneDrive(buffer, uniqueName, file.type);
  } else {
    // Store locally for PDFs and images
    const dir = path.join(process.cwd(), "public", "uploads", "po-attachments");
    await mkdir(dir, { recursive: true });
    const filename = `${crypto.randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    fileUrl = `/uploads/po-attachments/${filename}`;
  }

  const attachment = await prisma.pOAttachment.create({
    data: {
      poId: id,
      type: type as never,
      fileName: file.name,
      url: fileUrl,
      mimeType: file.type,
      fileSize: file.size,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
