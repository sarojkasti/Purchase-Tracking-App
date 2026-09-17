import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const attachment = await prisma.pOAttachment.delete({ where: { id: attachmentId } });

  const filePath = path.join(process.cwd(), "public", attachment.url);
  await unlink(filePath).catch(() => {});

  return NextResponse.json({ ok: true });
}
