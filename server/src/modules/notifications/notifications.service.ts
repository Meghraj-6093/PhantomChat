import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { publicUserSelect } from "../../utils/publicUser";
import { emitToUser } from "../../sockets/emitter";

interface CreateNotificationInput {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: input,
    include: { actor: { select: publicUserSelect } },
  });
  emitToUser(input.recipientId, "notification:new", notification);
  return notification;
}

export async function listNotifications(userId: string, cursor?: string, limit = 30) {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    include: { actor: { select: publicUserSelect } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { recipientId: userId, isRead: false } });
}

export async function markRead(userId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: { recipientId: userId, ...(ids ? { id: { in: ids } } : {}) },
    data: { isRead: true },
  });
}

export async function clearAll(userId: string) {
  await prisma.notification.deleteMany({ where: { recipientId: userId } });
}
