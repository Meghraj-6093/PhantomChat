import type { Request, Response } from "express";
import crypto from "crypto";
import { env, isProd } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import * as authService from "./auth.service";
import * as oauth from "./oauth.providers";
import { kv } from "../../lib/kv";

const REFRESH_COOKIE = "phantom_refresh";

function meta(req: Request) {
  return { userAgent: req.headers["user-agent"], ip: req.ip };
}

function setRefreshCookie(res: Response, token: string) {
  const secure = env.COOKIE_SECURE || isProd;
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure,
    // Cross-site fetch()/XHR only carries cookies when SameSite=None (and thus
    // requires Secure). Lax works for same-origin/subdomain dev, but the
    // moment the client (e.g. Vercel) and API (e.g. Railway) are on different
    // domains, Lax cookies are dropped on POST/fetch and refresh silently fails.
    sameSite: secure ? "none" : "lax",
    path: "/api/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  const secure = env.COOKIE_SECURE || isProd;
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth", secure, sameSite: secure ? "none" : "lax" });
}

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized("No refresh token");
  const result = await authService.refresh(token, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.json({ success: true, data: null });
});

export const sessions = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authService.listSessions(req.auth!.sub) });
});

export const revokeSession = asyncHandler(async (req, res) => {
  await authService.revokeSession(req.auth!.sub, req.params.id!);
  res.json({ success: true, data: null });
});

export const revokeAllSessions = asyncHandler(async (req, res) => {
  await authService.revokeAllSessions(req.auth!.sub);
  clearRefreshCookie(res);
  res.json({ success: true, data: null });
});

export const requestVerifyEmail = asyncHandler(async (req, res) => {
  await authService.requestEmailVerification(req.auth!.sub);
  res.json({ success: true, data: null });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  res.json({ success: true, data: null });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  res.json({ success: true, data: null });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, data: null });
});

export const initTwoFactor = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authService.initTwoFactor(req.auth!.sub) });
});

export const enableTwoFactor = asyncHandler(async (req, res) => {
  await authService.enableTwoFactor(req.auth!.sub, req.body.code);
  res.json({ success: true, data: null });
});

export const disableTwoFactor = asyncHandler(async (req, res) => {
  await authService.disableTwoFactor(req.auth!.sub, req.body.code);
  res.json({ success: true, data: null });
});

// ─────────────────────────── OAuth ───────────────────────────
// GET /oauth/:provider  -> { url } — client redirects the browser there.
// POST /oauth/:provider/callback { code, state } -> tokens.

const OAUTH_STATE_TTL = 600;

export const oauthStart = asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  const state = crypto.randomBytes(16).toString("hex");
  await kv.set(`oauth_state:${state}`, provider!, { ttl: OAUTH_STATE_TTL });
  const url =
    provider === "google" ? oauth.googleAuthUrl(state)
    : provider === "github" ? oauth.githubAuthUrl(state)
    : null;
  if (!url) throw ApiError.badRequest("Unknown OAuth provider");
  res.json({ success: true, data: { url } });
});

export const oauthCallback = asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  const { code, state } = req.body as { code?: string; state?: string };
  if (!code || !state) throw ApiError.badRequest("Missing code or state");

  const stored = await kv.getdel(`oauth_state:${state}`);
  if (stored !== provider) throw ApiError.badRequest("Invalid OAuth state");

  const profile =
    provider === "google" ? await oauth.exchangeGoogleCode(code)
    : provider === "github" ? await oauth.exchangeGithubCode(code)
    : null;
  if (!profile) throw ApiError.badRequest("Unknown OAuth provider");

  const result = await authService.oauthLogin(
    provider === "google" ? "GOOGLE" : "GITHUB",
    profile,
    meta(req)
  );
  setRefreshCookie(res, result.refreshToken);
  res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
});
