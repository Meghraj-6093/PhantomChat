import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { publicUserSelect } from "../../utils/publicUser";
import { emitToChat, emitToUser, getIo } from "../../sockets/emitter";
import type { ChatMemberRole, ChatType } from "@prisma/client";

const chatInclude = {
  members: {
    include: { user: { select: publicUserSelect } },
    take: 50,
  },
  _count: { select: { members: true } },
} as const;

export async function assertMember(chatId: string, userId: string, roles?: ChatMemberRole[]) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
    include: { chat: true },
  });
  if (!member) throw ApiError.forbidden("You are not a member of this chat");
  if (roles && !roles.includes(member.role)) throw ApiError.forbidden("Insufficient chat permissions");
  return member;
}

async function withMeta(chats: Awaited<ReturnType<typeof rawChatsFor>>, userId: string) {
  return Promise.all(
    chats.map(async (chat) => {
      const me = chat.members.find((m) => m.userId === userId);
      const [lastMessage, unreadCount] = await Promise.all([
        prisma.message.findFirst({
          where: { chatId: chat.id, isDeleted: false, isSent: true, threadRootId: null },
          orderBy: { createdAt: "desc" },
          include: { sender: { select: publicUserSelect } },
        }),
        me
          ? prisma.message.count({
              where: {
                chatId: chat.id,
                isDeleted: false,
                isSent: true,
                createdAt: { gt: me.lastReadAt },
                senderId: { not: userId },
              },
            })
          : Promise.resolve(0),
      ]);
      return { ...chat, lastMessage, unreadCount, myRole: me?.role ?? null };
    })
  );
}

function rawChatsFor(userId: string) {
  return prisma.chat.findMany({
    where: { members: { some: { userId } } },
    include: chatInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function listMyChats(userId: string) {
  const chats = await rawChatsFor(userId);
  return withMeta(chats, userId);
}

export async function getChat(chatId: string, userId: string) {
  await assertMember(chatId, userId);
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, include: chatInclude });
  if (!chat) throw ApiError.notFound("Chat not found");
  const [withExtra] = await withMeta([chat], userId);
  return withExtra!;
}

export async function getOrCreateDm(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw ApiError.badRequest("Cannot DM yourself");
  const other = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!other || other.isBanned) throw ApiError.notFound("User not found");

  const blocked = await prisma.friendship.findFirst({
    where: {
      status: "BLOCKED",
      OR: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId },
      ],
    },
  });
  if (blocked) throw ApiError.forbidden("Unable to message this user");

  const existing = await prisma.chat.findFirst({
    where: {
      type: "DM",
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: otherUserId } } },
      ],
    },
    include: chatInclude,
  });
  if (existing) {
    const [chat] = await withMeta([existing], userId);
    return chat!;
  }

  const created = await prisma.chat.create({
    data: {
      type: "DM",
      members: { create: [{ userId, role: "MEMBER" }, { userId: otherUserId, role: "MEMBER" }] },
    },
    include: chatInclude,
  });
  const [chat] = await withMeta([created], userId);
  emitToUser(otherUserId, "chat:new", chat);
  return chat!;
}

export interface CreateGroupInput {
  type: Extract<ChatType, "GROUP" | "CHANNEL">;
  name: string;
  description?: string;
  isPublic?: boolean;
  memberIds?: string[];
}

export async function createGroup(userId: string, input: CreateGroupInput) {
  const memberIds = [...new Set(input.memberIds ?? [])].filter((id) => id !== userId);
  const chat = await prisma.chat.create({
    data: {
      type: input.type,
      name: input.name,
      description: input.description,
      isPublic: input.isPublic ?? false,
      ownerId: userId,
      members: {
        create: [
          { userId, role: "OWNER" },
          ...memberIds.map((id) => ({ userId: id, role: "MEMBER" as const })),
        ],
      },
    },
    include: chatInclude,
  });
  const [withExtra] = await withMeta([chat], userId);
  for (const id of memberIds) emitToUser(id, "chat:new", withExtra);
  return withExtra!;
}

export async function updateChat(
  chatId: string,
  userId: string,
  input: { name?: string; description?: string; avatarUrl?: string; isPublic?: boolean; slowModeSeconds?: number }
) {
  await assertMember(chatId, userId, ["OWNER", "ADMIN"]);
  const chat = await prisma.chat.update({ where: { id: chatId }, data: input, include: chatInclude });
  emitToChat(chatId, "chat:updated", chat);
  return chat;
}

export async function discoverPublic(query: string | undefined, limit = 30) {
  return prisma.chat.findMany({
    where: {
      isPublic: true,
      type: { in: ["GROUP", "CHANNEL"] },
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    include: { _count: { select: { members: true } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function joinPublicChat(chatId: string, userId: string) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat || !chat.isPublic) throw ApiError.notFound("Chat not found");
  await prisma.chatMember.upsert({
    where: { chatId_userId: { chatId, userId } },
    create: { chatId, userId },
    update: {},
  });
  await joinSocketRoom(userId, chatId);
  return getChat(chatId, userId);
}

export async function addMembers(chatId: string, userId: string, memberIds: string[]) {
  await assertMember(chatId, userId, ["OWNER", "ADMIN", "MODERATOR"]);
  const unique = [...new Set(memberIds)];
  await prisma.chatMember.createMany({
    data: unique.map((id) => ({ chatId, userId: id })),
    skipDuplicates: true,
  });
  const chat = await getChat(chatId, userId);
  for (const id of unique) {
    emitToUser(id, "chat:new", chat);
    await joinSocketRoom(id, chatId);
  }
  emitToChat(chatId, "chat:updated", chat);
  return chat;
}

export async function removeMember(chatId: string, actorId: string, targetUserId: string) {
  if (actorId !== targetUserId) {
    const actor = await assertMember(chatId, actorId, ["OWNER", "ADMIN", "MODERATOR"]);
    const target = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: targetUserId } } });
    if (!target) throw ApiError.notFound("Member not found");
    const rank: Record<string, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };
    if ((rank[target.role] ?? 0) >= (rank[actor.role] ?? 0)) throw ApiError.forbidden("Cannot remove this member");
  }
  await prisma.chatMember.deleteMany({ where: { chatId, userId: targetUserId } });
  emitToChat(chatId, "chat:member_left", { chatId, userId: targetUserId });
  emitToUser(targetUserId, "chat:removed", { chatId });
}

export async function setMemberRole(chatId: string, actorId: string, targetUserId: string, role: ChatMemberRole) {
  await assertMember(chatId, actorId, ["OWNER", "ADMIN"]);
  if (role === "OWNER") throw ApiError.badRequest("Ownership transfer not supported here");
  const member = await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId: targetUserId } },
    data: { role },
    include: { user: { select: publicUserSelect } },
  });
  emitToChat(chatId, "chat:member_updated", member);
  return member;
}

export async function deleteChat(chatId: string, userId: string) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) throw ApiError.notFound("Chat not found");
  if (chat.type !== "DM") await assertMember(chatId, userId, ["OWNER"]);
  else await assertMember(chatId, userId);
  emitToChat(chatId, "chat:removed", { chatId });
  await prisma.chat.delete({ where: { id: chatId } });
}

export async function markChatRead(chatId: string, userId: string) {
  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId } },
    data: { lastReadAt: new Date() },
  });
}

/** Live sockets for a user join the chat room immediately after membership changes. */
async function joinSocketRoom(userId: string, chatId: string) {
  const io = getIo();
  if (!io) return;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  for (const s of sockets) s.join(`chat:${chatId}`);
}
