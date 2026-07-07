import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("error", (err) => logger.error({ err }, "Redis error"));
redis.on("connect", () => logger.info("Redis connected"));

/** Presence keys: presence:{userId} -> socket count; TTL-refreshed. */
export const presenceKey = (userId: string) => `presence:${userId}`;
