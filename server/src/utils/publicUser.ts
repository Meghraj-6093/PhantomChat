import type { User } from "@prisma/client";

export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bannerUrl: true,
  bio: true,
  statusText: true,
  status: true,
  role: true,
  lastSeenAt: true,
  createdAt: true,
} as const;

export function toPublicUser(user: User) {
  const { id, username, displayName, avatarUrl, bannerUrl, bio, statusText, status, role, lastSeenAt, createdAt } = user;
  return { id, username, displayName, avatarUrl, bannerUrl, bio, statusText, status, role, lastSeenAt, createdAt };
}

export function toPrivateUser(user: User) {
  return {
    ...toPublicUser(user),
    email: user.email,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}
