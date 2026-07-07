import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { publicUserSelect } from "../../utils/publicUser";
import { emitToUser } from "../../sockets/emitter";
import type { Prisma, ReportStatus, UserRole } from "@prisma/client";

export async function getStats() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, newUsersToday, totalMessages, messagesToday, totalChats, onlineUsers, openReports, bannedUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.message.count(),
      prisma.message.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.chat.count(),
      prisma.user.count({ where: { status: { not: "OFFLINE" } } }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.user.count({ where: { isBanned: true } }),
    ]);

  // Message volume per day for the past week (for the dashboard chart).
  const raw = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM "Message"
    WHERE "createdAt" >= ${weekAgo}
    GROUP BY day ORDER BY day ASC
  `;
  const messagesPerDay = raw.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: Number(r.count) }));

  return {
    totalUsers, newUsersToday, totalMessages, messagesToday,
    totalChats, onlineUsers, openReports, bannedUsers, messagesPerDay,
  };
}

export async function listUsers(opts: { q?: string; page?: number; pageSize?: number }) {
  const page = Math.max(opts.page ?? 1, 1);
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const where: Prisma.UserWhereInput = opts.q
    ? {
        OR: [
          { username: { contains: opts.q, mode: "insensitive" } },
          { email: { contains: opts.q, mode: "insensitive" } },
          { displayName: { contains: opts.q, mode: "insensitive" } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { ...publicUserSelect, email: true, isBanned: true, banReason: true, emailVerified: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function audit(actorId: string, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({ data: { actorId, action, targetType, targetId, metadata } });
}

export async function setBan(actorId: string, userId: string, banned: boolean, reason?: string) {
  if (actorId === userId) throw ApiError.badRequest("You cannot ban yourself");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw ApiError.notFound("User not found");
  if (target.role === "ADMIN") throw ApiError.forbidden("Cannot ban an admin");

  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: banned, banReason: banned ? reason ?? "Policy violation" : null },
  });
  if (banned) {
    await prisma.session.deleteMany({ where: { userId } });
    emitToUser(userId, "auth:force_logout", { reason: reason ?? "banned" });
  }
  await audit(actorId, banned ? "user.ban" : "user.unban", "user", userId, { reason: reason ?? null });
}

export async function setRole(actorId: string, userId: string, role: UserRole) {
  if (actorId === userId) throw ApiError.badRequest("You cannot change your own role");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit(actorId, "user.role", "user", userId, { role });
}

export async function listReports(status?: ReportStatus) {
  return prisma.report.findMany({
    where: status ? { status } : {},
    include: {
      reporter: { select: publicUserSelect },
      target: { select: publicUserSelect },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function resolveReport(actorId: string, reportId: string, status: ReportStatus) {
  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status, resolvedAt: status === "RESOLVED" || status === "DISMISSED" ? new Date() : null },
  });
  await audit(actorId, "report.update", "report", reportId, { status });
  return report;
}

export async function createReport(reporterId: string, input: { targetId: string; messageId?: string; reason: string }) {
  return prisma.report.create({
    data: { reporterId, targetId: input.targetId, messageId: input.messageId, reason: input.reason },
  });
}

export async function listAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    include: { actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function adminDeleteMessage(actorId: string, messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound("Message not found");
  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, content: null, type: "SYSTEM" },
  });
  await audit(actorId, "message.delete", "message", messageId, { chatId: message.chatId });
}
