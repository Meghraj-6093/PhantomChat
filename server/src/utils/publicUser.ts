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
  publicKey: true, // peers encrypt to this (E2EE)
} as const;

export function toPublicUser(user: User) {
  const { id, username, displayName, avatarUrl, bannerUrl, bio, statusText, status, role, lastSeenAt, createdAt, publicKey } = user;
  return { id, username, displayName, avatarUrl, bannerUrl, bio, statusText, status, role, lastSeenAt, createdAt, publicKey };
}

export function toPrivateUser(user: User) {
  return {
    ...toPublicUser(user),
    email: user.email,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    // Whether a passphrase-wrapped private-key backup exists on the server, so
    // the client knows to restore vs. generate keys. The blob itself is fetched
    // via GET /users/me/keys only when a restore is actually needed.
    hasKeyBackup: !!user.encryptedPrivateKey,
  };
}
