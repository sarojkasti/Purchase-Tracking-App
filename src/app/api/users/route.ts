import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, active: true, roleId: true, role: { select: { name: true } }, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { name, email, password, roleId } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 400 });

  const hashed = password ? await bcrypt.hash(password, 10) : null;
  const user = await prisma.user.create({
    data: { name, email, password: hashed, roleId: roleId || null },
    select: { id: true, name: true, email: true, active: true, roleId: true },
  });
  return NextResponse.json(user, { status: 201 });
}
