import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";

export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

// Strip any trailing slash so a CLIENT_URL like "https://example.com/" doesn't
// produce a double-slash redirect_uri that silently fails to match what's
// registered in the Google/GitHub OAuth app settings.
const redirectUri = (provider: string) => `${env.CLIENT_URL.replace(/\/+$/, "")}/auth/callback/${provider}`;

export function googleAuthUrl(state: string): string {
  if (!env.GOOGLE_CLIENT_ID) throw ApiError.badRequest("Google login is not configured");
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri("google"),
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function githubAuthUrl(state: string): string {
  if (!env.GITHUB_CLIENT_ID) throw ApiError.badRequest("GitHub login is not configured");
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri("github"),
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<OAuthProfile> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw ApiError.badRequest("Google login is not configured");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri("google"),
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw ApiError.badRequest("Google authorization failed");

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const p = (await profileRes.json()) as { sub: string; email?: string; name?: string; picture?: string };
  if (!p.email) throw ApiError.badRequest("Google account has no email");
  return { providerId: p.sub, email: p.email, name: p.name ?? p.email, avatarUrl: p.picture };
}

export async function exchangeGithubCode(code: string): Promise<OAuthProfile> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw ApiError.badRequest("GitHub login is not configured");
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      code,
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      redirect_uri: redirectUri("github"),
    }),
  });
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw ApiError.badRequest("GitHub authorization failed");

  const headers = { Authorization: `Bearer ${tokens.access_token}`, "User-Agent": "PhantomChat" };
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);
  const u = (await userRes.json()) as { id: number; login: string; name?: string; avatar_url?: string };
  const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
  const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) ?? emails[0] : undefined;
  if (!primary) throw ApiError.badRequest("GitHub account has no accessible email");
  return { providerId: String(u.id), email: primary.email, name: u.name ?? u.login, avatarUrl: u.avatar_url };
}
