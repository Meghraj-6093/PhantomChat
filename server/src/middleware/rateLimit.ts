import rateLimit from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { env } from "../config/env";

/**
 * On a persistent single-process host, express-rate-limit's default in-memory
 * store is fine. On serverless (Vercel), each invocation may land on a
 * different, ephemeral instance, so in-memory counters never accumulate and
 * the limits are effectively toothless. When Upstash Redis REST creds are
 * present we back the limiters with a shared fixed-window counter (over the
 * REST API, so there's no persistent socket to manage); otherwise we fall back
 * to the in-memory limiter. Either way the call sites below are identical.
 */
const redisEnabled = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

interface LimiterConfig {
  name: string;
  windowMs: number;
  limit: number;
  message: unknown;
  skip?: (req: Request) => boolean;
}

/** Increment this IP's counter for the current window; null on any Redis error (fail open). */
async function redisIncr(name: string, id: string, windowMs: number): Promise<number | null> {
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `rl:${name}:${id}:${bucket}`;
  try {
    const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        // Re-arming the expiry each hit is harmless and guarantees the bucket
        // is reaped even if the very first INCR's expiry set somehow raced.
        ["PEXPIRE", key, windowMs],
      ]),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = data?.[0]?.result;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

function createRedisLimiter(cfg: LimiterConfig): RequestHandler {
  const retryAfter = Math.ceil(cfg.windowMs / 1000);
  return (req, res, next) => {
    if (cfg.skip?.(req)) return next();
    const id = req.ip ?? "unknown";
    redisIncr(cfg.name, id, cfg.windowMs)
      .then((count) => {
        if (count === null) return next(); // Redis unavailable → don't block traffic.
        res.setHeader("RateLimit-Limit", String(cfg.limit));
        res.setHeader("RateLimit-Remaining", String(Math.max(0, cfg.limit - count)));
        if (count > cfg.limit) {
          res.setHeader("Retry-After", String(retryAfter));
          return res.status(429).json(cfg.message);
        }
        return next();
      })
      .catch(() => next());
  };
}

export function createRateLimiter(cfg: LimiterConfig): RequestHandler {
  if (redisEnabled) return createRedisLimiter(cfg);
  return rateLimit({
    windowMs: cfg.windowMs,
    limit: cfg.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: cfg.message,
    skip: cfg.skip,
  });
}

export const apiLimiter = createRateLimiter({
  name: "api",
  windowMs: 60 * 1000,
  limit: 300,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } },
  // The chat list / messages / read endpoints are polled aggressively when
  // there's no live socket (serverless). They get their own generous limiter
  // on the chats router (`chatsLimiter`), so exempt them here rather than
  // letting one active tab's polling eat the whole global budget.
  skip: (req) => {
    const path = req.originalUrl.split("?")[0] ?? "";
    if (req.method === "GET" && path.startsWith("/api/chats")) return true;
    if (req.method === "POST" && path.endsWith("/read")) return true;
    return false;
  },
});

export const chatsLimiter = createRateLimiter({
  name: "chats",
  windowMs: 60 * 1000,
  // Headroom for the polling fallback: ~1 req/s for messages + list + detail +
  // read-marking across a couple of open tabs stays well under this.
  limit: 2000,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } },
});

export const authLimiter = createRateLimiter({
  name: "auth",
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many auth attempts, try later" } },
});

export const uploadLimiter = createRateLimiter({
  name: "upload",
  windowMs: 60 * 1000,
  limit: 20,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Upload limit reached" } },
});
