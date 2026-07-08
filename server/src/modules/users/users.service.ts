import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { publicUserSelect, toPrivateUser } from "../../utils/publicUser";

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  return toPrivateUser(user);
}

export async function getByUsername(username: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: publicUserSelect,
  });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  statusText?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  status?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  return toPrivateUser(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.passwordHash) {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw ApiError.unauthorized("Current password is incorrect");
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/** Returns the caller's own E2EE key material (public key + wrapped backup). */
export async function getMyKeys(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { publicKey: true, encryptedPrivateKey: true },
  });
  if (!user) throw ApiError.notFound("User not found");
  return { publicKey: user.publicKey, encryptedPrivateKey: user.encryptedPrivateKey };
}

/** Publishes the caller's public key and passphrase-wrapped private-key backup. */
export async function setMyKeys(userId: string, publicKey: string, encryptedPrivateKey: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { publicKey, encryptedPrivateKey },
  });
}

export async function searchUsers(query: string, excludeUserId: string, limit = 20) {
  return prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      isBanned: false,
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: publicUserSelect,
    take: limit,
    orderBy: { username: "asc" },
  });
}
