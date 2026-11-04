import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
  return NextResponse.json(roles);
}

export async function POST(req: NextRequest) {
  const { name, permissions } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const role = await prisma.role.create({ data: { name: name.trim(), permissions: permissions ?? {} } });
  return NextResponse.json(role, { status: 201 });
}
