import { prisma } from "@/lib/prisma";

type AuditAction = "LOGIN" | "LOGOUT" | "CREATE" | "UPDATE" | "DELETE" | "VIEW";

export async function logAudit({
  userId,
  userEmail,
  action,
  entity,
  entityId,
  detail,
  ip,
}: {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  detail?: string;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: { userId, userEmail, action, entity, entityId, detail, ip },
    });
  } catch {
    // audit failures must never break the main request
  }
}

export async function updateUserLastSeen(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    // ignore
  }
}
