import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/graphMail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Always return success to avoid user enumeration
  // Allow inactive users with no password (pending activation) to get a new link
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  // Invalidate old tokens for this email
  await prisma.passwordResetToken.deleteMany({ where: { email: email.toLowerCase() } });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      email: email.toLowerCase(),
      token,
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await sendMail({
    to: email,
    subject: "Purchase Tracker – Password Reset",
    html: `
      <p>Hi ${user.name ?? "there"},</p>
      <p>You requested a password reset. Click the link below to set a new password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
