import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authenticator } from "otplib";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { ApiError } from "../../utils/ApiError";
import {
  generateRefreshToken,
  hashToken,
  refreshExpiry,
  signAccessToken,
} from "../../utils/jwt";
import { toPrivateUser } from "../../utils/publicUser";
import type { LoginInput, RegisterInput } from "./auth.validation";
import type { User } from "@prisma/client";

interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

async function issueTokens(user: User, meta: SessionMeta) {
  const { token: refreshToken, hash } = generateRefreshToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hash,
      userAgent: meta.userAgent?.slice(0, 255),
      ip: meta.ip,
      expiresAt: refreshExpiry(),
    },
  });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, username: user.username });
  return { accessToken, refreshToken, user: toPrivateUser(user) };
}

export async function register(input: RegisterInput, meta: SessionMeta) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email.toLowerCase() }, { username: input.username.toLowerCase() }] },
  });
  if (existing) throw ApiError.conflict("Email or username already in use");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      username: input.username.toLowerCase(),
      displayName: input.displayName,
      passwordHash,
    },
  });

  await createVerificationToken(user.id, "EMAIL_VERIFY");
  return issueTokens(user, meta);
}

export async function login(input: LoginInput, meta: SessionMeta) {
  const identifier = input.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });
  if (!user?.passwordHash) throw ApiError.unauthorized("Invalid credentials");
  if (user.isBanned) throw ApiError.forbidden(`Account banned: ${user.banReason ?? "policy violation"}`);

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid credentials");

  if (user.twoFactorEnabled) {
    if (!input.totp) throw new ApiError(401, "Two-factor code required", "TOTP_REQUIRED");
    if (!user.twoFactorSecret || !authenticator.verify({ token: input.totp, secret: user.twoFactorSecret })) {
      throw ApiError.unauthorized("Invalid two-factor code");
    }
  }

  return issueTokens(user, meta);
}

export async function refresh(refreshToken: string, meta: SessionMeta) {
  const hash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hash },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    throw ApiError.unauthorized("Invalid refresh token");
  }
  if (session.user.isBanned) throw ApiError.forbidden("Account banned");

  // Rotate: replace the stored hash atomically.
  const { token: newToken, hash: newHash } = generateRefreshToken();
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      lastUsedAt: new Date(),
      expiresAt: refreshExpiry(),
      userAgent: meta.userAgent?.slice(0, 255) ?? session.userAgent,
      ip: meta.ip ?? session.ip,
    },
  });

  const accessToken = signAccessToken({
    sub: session.user.id,
    role: session.user.role,
    username: session.user.username,
  });
  return { accessToken, refreshToken: newToken, user: toPrivateUser(session.user) };
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  await prisma.session.deleteMany({ where: { refreshTokenHash: hashToken(refreshToken) } });
}

export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
    orderBy: { lastUsedAt: "desc" },
  });
}

export async function revokeSession(userId: string, sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId, userId } });
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

// ─────────────────────────── Email flows ───────────────────────────
// In production, plug a mail provider into `deliverToken`. In development the
// link is logged so flows are fully testable without SMTP.

async function createVerificationToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET") {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.verificationToken.deleteMany({ where: { userId, type } });
  await prisma.verificationToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
  deliverToken(userId, type, token);
  return token;
}

function deliverToken(userId: string, type: string, token: string) {
  logger.info({ userId, type, token }, "Verification token issued (wire up SMTP to email this)");
}

export async function requestEmailVerification(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.emailVerified) throw ApiError.badRequest("Email already verified");
  await createVerificationToken(userId, "EMAIL_VERIFY");
}

export async function verifyEmail(token: string) {
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== "EMAIL_VERIFY" || record.expiresAt < new Date()) {
    throw ApiError.badRequest("Invalid or expired verification token");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Silently succeed to avoid account enumeration.
  if (user) await createVerificationToken(user.id, "PASSWORD_RESET");
}

export async function resetPassword(token: string, password: string) {
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== "PASSWORD_RESET" || record.expiresAt < new Date()) {
    throw ApiError.badRequest("Invalid or expired reset token");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}

// ─────────────────────────── Two-factor ───────────────────────────

export async function initTwoFactor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
  const otpauthUrl = authenticator.keyuri(user.email, "PhantomChat", secret);
  return { secret, otpauthUrl };
}

export async function enableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) throw ApiError.badRequest("Two-factor setup not initiated");
  if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    throw ApiError.badRequest("Invalid code");
  }
  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
}

export async function disableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) throw ApiError.badRequest("Two-factor not enabled");
  if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    throw ApiError.badRequest("Invalid code");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
}

// ─────────────────────────── OAuth ───────────────────────────

export async function oauthLogin(
  provider: "GOOGLE" | "GITHUB",
  profile: { providerId: string; email: string; name: string; avatarUrl?: string },
  meta: SessionMeta
) {
  const account = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId: profile.providerId } },
    include: { user: true },
  });
  if (account) {
    if (account.user.isBanned) throw ApiError.forbidden("Account banned");
    return issueTokens(account.user, meta);
  }

  let user = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
  if (!user) {
    const base = profile.email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 18) || "user";
    let username = base;
    for (let i = 0; await prisma.user.findUnique({ where: { username } }); i++) {
      username = `${base}${Math.floor(Math.random() * 10000)}`;
      if (i > 5) username = `${base}${Date.now()}`;
    }
    user = await prisma.user.create({
      data: {
        email: profile.email.toLowerCase(),
        username,
        displayName: profile.name || username,
        avatarUrl: profile.avatarUrl,
        emailVerified: true,
      },
    });
  }

  await prisma.oAuthAccount.create({
    data: { provider, providerId: profile.providerId, userId: user.id },
  });
  return issueTokens(user, meta);
}
