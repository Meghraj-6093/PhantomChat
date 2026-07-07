import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { publicUserSelect } from "../../utils/publicUser";
import { createNotification } from "../notifications/notifications.service";

export async function listFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: publicUserSelect },
      addressee: { select: publicUserSelect },
    },
  });
  return friendships.map((f) => ({
    friendshipId: f.id,
    user: f.requesterId === userId ? f.addressee : f.requester,
    since: f.updatedAt,
  }));
}

export async function listPending(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: { addresseeId: userId, status: "PENDING" },
      include: { requester: { select: publicUserSelect } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendship.findMany({
      where: { requesterId: userId, status: "PENDING" },
      include: { addressee: { select: publicUserSelect } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    incoming: incoming.map((f) => ({ friendshipId: f.id, user: f.requester, createdAt: f.createdAt })),
    outgoing: outgoing.map((f) => ({ friendshipId: f.id, user: f.addressee, createdAt: f.createdAt })),
  };
}

export async function sendRequest(requesterId: string, targetUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: targetUsername.toLowerCase() } });
  if (!target || target.isBanned) throw ApiError.notFound("User not found");
  if (target.id === requesterId) throw ApiError.badRequest("You cannot add yourself");

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: requesterId },
      ],
    },
  });
  if (existing) {
    if (existing.status === "BLOCKED") throw ApiError.forbidden("Unable to send request");
    if (existing.status === "ACCEPTED") throw ApiError.conflict("Already friends");
    if (existing.status === "PENDING") {
      // If they already requested us, auto-accept.
      if (existing.requesterId === target.id) return respond(requesterId, existing.id, true);
      throw ApiError.conflict("Request already sent");
    }
    await prisma.friendship.delete({ where: { id: existing.id } });
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId, addresseeId: target.id },
  });
  await createNotification({
    recipientId: target.id,
    actorId: requesterId,
    type: "FRIEND_REQUEST",
    title: "New friend request",
    data: { friendshipId: friendship.id },
  });
  return friendship;
}

export async function respond(userId: string, friendshipId: string, accept: boolean) {
  const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!friendship || friendship.addresseeId !== userId || friendship.status !== "PENDING") {
    throw ApiError.notFound("Friend request not found");
  }
  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });
  if (accept) {
    await createNotification({
      recipientId: friendship.requesterId,
      actorId: userId,
      type: "FRIEND_ACCEPT",
      title: "Friend request accepted",
    });
  }
  return updated;
}

export async function removeFriend(userId: string, friendshipId: string) {
  const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!friendship || (friendship.requesterId !== userId && friendship.addresseeId !== userId)) {
    throw ApiError.notFound("Friendship not found");
  }
  await prisma.friendship.delete({ where: { id: friendshipId } });
}

export async function blockUser(userId: string, targetId: string) {
  if (userId === targetId) throw ApiError.badRequest("You cannot block yourself");
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: userId, addresseeId: targetId },
        { requesterId: targetId, addresseeId: userId },
      ],
    },
  });
  return prisma.friendship.create({
    data: { requesterId: userId, addresseeId: targetId, status: "BLOCKED" },
  });
}

export async function unblockUser(userId: string, targetId: string) {
  await prisma.friendship.deleteMany({
    where: { requesterId: userId, addresseeId: targetId, status: "BLOCKED" },
  });
}

export async function listBlocked(userId: string) {
  const blocked = await prisma.friendship.findMany({
    where: { requesterId: userId, status: "BLOCKED" },
    include: { addressee: { select: publicUserSelect } },
  });
  return blocked.map((f) => ({ friendshipId: f.id, user: f.addressee }));
}
