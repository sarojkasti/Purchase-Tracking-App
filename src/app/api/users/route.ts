import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/graphMail";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, active: true, roleId: true, role: { select: { name: true } }, createdAt: true, password: true },
  });
  // Don't expose the hash — just whether a password is set
  const sanitized = users.map(({ password, ...u }) => ({ ...u, hasPassword: !!password }));
  return NextResponse.json(sanitized);
}

export async function POST(req: NextRequest) {
  const { name, email, roleId } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 400 });

  const user = await prisma.user.create({
    data: { name, email, password: null, roleId: roleId || null, active: false },
    select: { id: true, name: true, email: true, active: true, roleId: true },
  });

  // Create activation token (reuses PasswordResetToken)
  await prisma.passwordResetToken.deleteMany({ where: { email } });
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { email, token, expires: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const activationUrl = `${baseUrl}/reset-password?token=${token}`;

  try {
    await sendMail({
      to: email,
      subject: "Purchase Tracker – Activate Your Account",
      html: `
        <p>Hi ${name ?? "there"},</p>
        <p>An account has been created for you on the Purchase Tracking App. Click the link below to set your password and activate your account. This link expires in 24 hours.</p>
        <p><a href="${activationUrl}">${activationUrl}</a></p>
        <p>If you were not expecting this, you can ignore this email.</p>
      `,
    });
  } catch (err) {
    // User was created; log the mail failure but don't fail the request
    console.error("Failed to send activation email:", err);
    return NextResponse.json({ ...user, emailError: "User created but activation email could not be sent." }, { status: 201 });
  }

  return NextResponse.json(user, { status: 201 });
}
