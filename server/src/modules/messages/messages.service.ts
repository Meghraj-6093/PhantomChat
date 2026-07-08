import type { MessageType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { publicUserSelect } from "../../utils/publicUser";
import { sanitizeText, looksLikeSpam } from "../../utils/sanitize";
import { emitToChat, emitToUser } from "../../sockets/emitter";
import { assertMember } from "../chats/chats.service";
import { createNotification } from "../notifications/notifications.service";
import { kv } from "../../lib/kv";

export const messageInclude = {
  sender: { select: publicUserSelect },
  attachments: true,
  reactions: { include: { user: { select: { id: true, username: true, displayName: true } } } },
  replyTo: {
    include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  },
  _count: { select: { threadReplies: true, readReceipts: true } },
} as const;

export interface SendMessageInput {
  type?: MessageType;
  content?: string;
  isEncrypted?: boolean;
  replyToId?: string;
  threadRootId?: string;
  attachmentIds?: string[];
  scheduledFor?: string;
}

export async function sendMessage(chatId: string, senderId: string, input: SendMessageInput) {
  const member = await assertMember(chatId, senderId);
  if (member.isMuted) throw ApiError.forbidden("You are muted in this chat");

  // Channels: only staff can post.
  if (member.chat.type === "CHANNEL" && member.role === "MEMBER") {
    throw ApiError.forbidden("Only channel staff can post here");
  }

  // Slow mode enforcement — an NX lock keyed per chat+user, TTL = slow-mode window.
  if (member.chat.slowModeSeconds > 0 && member.role === "MEMBER") {
    const key = `slowmode:${chatId}:${senderId}`;
    const acquired = await kv.set(key, "1", { ttl: member.chat.slowModeSeconds, nx: true });
    if (!acquired) throw ApiError.tooMany(`Slow mode: wait ${member.chat.slowModeSeconds}s between messages`);
  }

  // Encrypted content is an opaque ciphertext envelope: the server can't (and
  // must not try to) sanitize, spam-check, or scan it for mentions.
  const encrypted = !!input.isEncrypted;
  const content = input.content ? (encrypted ? input.content : sanitizeText(input.content)) : undefined;
  if (!content && !input.attachmentIds?.length) throw ApiError.badRequest("Message is empty");
  if (!encrypted && content && looksLikeSpam(content)) throw ApiError.badRequest("Message flagged as spam");

  if (input.replyToId) {
    const target = await prisma.message.findFirst({ where: { id: input.replyToId, chatId } });
    if (!target) throw ApiError.badRequest("Reply target not found");
  }
  if (input.threadRootId) {
    const root = await prisma.message.findFirst({ where: { id: input.threadRootId, chatId } });
    if (!root) throw ApiError.badRequest("Thread root not found");
  }

  const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : undefined;
  if (scheduledFor && scheduledFor.getTime() < Date.now() + 5000) {
    throw ApiError.badRequest("Schedule time must be in the future");
  }

  const message = await prisma.message.create({
    data: {
      chatId,
      senderId,
      type: input.type ?? "TEXT",
      content,
      isEncrypted: encrypted,
      replyToId: input.replyToId,
      threadRootId: input.threadRootId,
      scheduledFor,
      isSent: !scheduledFor,
      ...(input.attachmentIds?.length
        ? { attachments: { connect: input.attachmentIds.map((id) => ({ id })) } }
        : {}),
    },
    include: messageInclude,
  });

  await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

  if (!scheduledFor) {
    emitToChat(chatId, "message:new", message);
    // Mentions can't be parsed from ciphertext; skip for encrypted messages.
    if (!encrypted) await notifyMentions(chatId, message.id, senderId, content);
  }
  return message;
}

/** Cron-ish dispatcher: flush due scheduled messages. Called from an interval at boot. */
export async function dispatchScheduledMessages() {
  const due = await prisma.message.findMany({
    where: { isSent: false, scheduledFor: { lte: new Date() } },
    include: messageInclude,
    take: 50,
  });
  for (const msg of due) {
    await prisma.message.update({ where: { id: msg.id }, data: { isSent: true, createdAt: new Date() } });
    emitToChat(msg.chatId, "message:new", { ...msg, isSent: true, createdAt: new Date() });
  }
}

async function notifyMentions(chatId: string, messageId: string, senderId: string, content?: string) {
  if (!content) return;
  const usernames = [...content.matchAll(/@([a-zA-Z0-9_.]{3,24})/g)].map((m) => m[1]!.toLowerCase());
  if (!usernames.length) return;
  const mentioned = await prisma.user.findMany({
    where: {
      username: { in: usernames },
      id: { not: senderId },
      memberships: { some: { chatId } },
    },
    select: { id: true },
  });
  await Promise.all(
    mentioned.map((u) =>
      createNotification({
        recipientId: u.id,
        actorId: senderId,
        type: "MENTION",
        title: "You were mentioned",
        body: content.slice(0, 140),
        data: { chatId, messageId },
      })
    )
  );
}

export async function listMessages(
  chatId: string,
  userId: string,
  opts: { cursor?: string; limit?: number; threadRootId?: string }
) {
  await assertMember(chatId, userId);
  const limit = Math.min(opts.limit ?? 50, 100);
  const messages = await prisma.message.findMany({
    where: {
      chatId,
      isSent: true,
      threadRootId: opts.threadRootId ?? null,
    },
    include: messageInclude,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  return { items: items.reverse(), nextCursor: hasMore ? items[0]?.id : undefined };
}

export async function searchMessages(chatId: string, userId: string, query: string, limit = 30) {
  await assertMember(chatId, userId);
  return prisma.message.findMany({
    where: {
      chatId,
      isDeleted: false,
      isSent: true,
      content: { contains: query, mode: "insensitive" },
    },
    include: messageInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function editMessage(chatId: string, messageId: string, userId: string, content: string) {
  const message = await prisma.message.findFirst({ where: { id: messageId, chatId } });
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found");
  if (message.senderId !== userId) throw ApiError.forbidden("You can only edit your own messages");

  const updated = await prisma.message.update({
    where: { id: messageId },
    // Preserve the ciphertext envelope untouched for encrypted messages.
    data: { content: message.isEncrypted ? content : sanitizeText(content), isEdited: true },
    include: messageInclude,
  });
  emitToChat(chatId, "message:updated", updated);
  return updated;
}

export async function deleteMessage(chatId: string, messageId: string, userId: string) {
  const message = await prisma.message.findFirst({ where: { id: messageId, chatId } });
  if (!message) throw ApiError.notFound("Message not found");
  if (message.senderId !== userId) {
    await assertMember(chatId, userId, ["OWNER", "ADMIN", "MODERATOR"]);
  }
  const deleted = await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, content: null, type: "SYSTEM" },
    include: messageInclude,
  });
  await prisma.attachment.deleteMany({ where: { messageId } });
  emitToChat(chatId, "message:deleted", { chatId, messageId, message: deleted });
  return deleted;
}

export async function toggleReaction(chatId: string, messageId: string, userId: string, emoji: string) {
  await assertMember(chatId, userId);
  const message = await prisma.message.findFirst({ where: { id: messageId, chatId } });
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found");

  const existing = await prisma.reaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({ data: { messageId, userId, emoji } });
    if (message.senderId && message.senderId !== userId) {
      await createNotification({
        recipientId: message.senderId,
        actorId: userId,
        type: "REACTION",
        title: `Reacted ${emoji} to your message`,
        data: { chatId, messageId },
      });
    }
  }
  const updated = await prisma.message.findUnique({ where: { id: messageId }, include: messageInclude });
  emitToChat(chatId, "message:updated", updated);
  return updated;
}

export async function pinMessage(chatId: string, messageId: string, userId: string) {
  await assertMember(chatId, userId, ["OWNER", "ADMIN", "MODERATOR"]);
  const message = await prisma.message.findFirst({ where: { id: messageId, chatId } });
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found");
  const pin = await prisma.pinnedMessage.upsert({
    where: { messageId },
    create: { chatId, messageId, pinnedById: userId },
    update: {},
    include: { message: { include: messageInclude } },
  });
  emitToChat(chatId, "message:pinned", pin);
  return pin;
}

export async function unpinMessage(chatId: string, messageId: string, userId: string) {
  await assertMember(chatId, userId, ["OWNER", "ADMIN", "MODERATOR"]);
  await prisma.pinnedMessage.deleteMany({ where: { chatId, messageId } });
  emitToChat(chatId, "message:unpinned", { chatId, messageId });
}

export async function listPins(chatId: string, userId: string) {
  await assertMember(chatId, userId);
  return prisma.pinnedMessage.findMany({
    where: { chatId },
    include: { message: { include: messageInclude }, pinnedBy: { select: publicUserSelect } },
    orderBy: { createdAt: "desc" },
  });
}

export async function markRead(chatId: string, userId: string, messageId: string) {
  const message = await prisma.message.findFirst({ where: { id: messageId, chatId } });
  if (!message) return;
  await prisma.readReceipt.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId },
    update: {},
  });
  await prisma.chatMember.updateMany({ where: { chatId, userId }, data: { lastReadAt: new Date() } });
  emitToChat(chatId, "message:read", { chatId, messageId, userId, readAt: new Date().toISOString() });
  if (message.senderId && message.senderId !== userId) {
    emitToUser(message.senderId, "message:read", {
      chatId, messageId, userId, readAt: new Date().toISOString(),
    });
  }
}

export async function listMedia(chatId: string, userId: string, limit = 60) {
  await assertMember(chatId, userId);
  return prisma.attachment.findMany({
    where: { message: { chatId, isDeleted: false } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function forwardMessage(userId: string, messageId: string, targetChatIds: string[]) {
  const source = await prisma.message.findUnique({ where: { id: messageId }, include: { attachments: true } });
  if (!source || source.isDeleted) throw ApiError.notFound("Message not found");
  // The envelope's keys are wrapped to the source chat's members only, so a
  // forwarded copy would be undecryptable in the target chat.
  if (source.isEncrypted) throw ApiError.badRequest("Encrypted messages can't be forwarded");
  await assertMember(source.chatId, userId);

  const results = [];
  for (const targetChatId of [...new Set(targetChatIds)].slice(0, 10)) {
    await assertMember(targetChatId, userId);
    const forwarded = await prisma.message.create({
      data: {
        chatId: targetChatId,
        senderId: userId,
        type: source.type === "SYSTEM" ? "TEXT" : source.type,
        content: source.content,
      },
      include: messageInclude,
    });
    emitToChat(targetChatId, "message:new", forwarded);
    results.push(forwarded);
  }
  return results;
}
