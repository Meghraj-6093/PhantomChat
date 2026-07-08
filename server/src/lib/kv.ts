import { prisma } from "./prisma";

/**
 * Postgres-backed key-value store — a drop-in for the small set of Redis
 * operations this app relies on (OAuth state, slow-mode locks, presence
 * counters, call flags). Backed by the `KeyValue` table so the app needs no
 * external cache. All TTL comparisons use an app-supplied `Date` (not SQL
 * now()) to stay timezone-safe regardless of the DB session timezone.
 */

function expiryDate(ttlSeconds?: number): Date | null {
  return ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
}

export const kv = {
  /**
   * SET key=value with optional TTL (seconds). With `nx`, only writes when the
   * key is absent or already expired (mirrors Redis `SET ... NX`). Returns
   * whether the write happened.
   */
  async set(key: string, value: string, opts: { ttl?: number; nx?: boolean } = {}): Promise<boolean> {
    const expiresAt = expiryDate(opts.ttl);
    if (opts.nx) {
      const now = new Date();
      const rows = await prisma.$queryRaw<Array<{ key: string }>>`
        INSERT INTO "KeyValue" ("key", "value", "expiresAt", "updatedAt")
        VALUES (${key}, ${value}, ${expiresAt}, ${now})
        ON CONFLICT ("key") DO UPDATE
          SET "value" = ${value}, "expiresAt" = ${expiresAt}, "updatedAt" = ${now}
          WHERE "KeyValue"."expiresAt" IS NOT NULL AND "KeyValue"."expiresAt" < ${now}
        RETURNING "key"
      `;
      return rows.length > 0;
    }
    await prisma.$executeRaw`
      INSERT INTO "KeyValue" ("key", "value", "expiresAt", "updatedAt")
      VALUES (${key}, ${value}, ${expiresAt}, ${new Date()})
      ON CONFLICT ("key") DO UPDATE
        SET "value" = ${value}, "expiresAt" = ${expiresAt}, "updatedAt" = ${new Date()}
    `;
    return true;
  },

  /** GET, returning null for missing or expired keys. */
  async get(key: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT "value" FROM "KeyValue"
      WHERE "key" = ${key} AND ("expiresAt" IS NULL OR "expiresAt" > ${new Date()})
      LIMIT 1
    `;
    return rows[0]?.value ?? null;
  },

  /** Atomic GET + DELETE (mirrors Redis `GETDEL`). Ignores expired rows. */
  async getdel(key: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      DELETE FROM "KeyValue"
      WHERE "key" = ${key} AND ("expiresAt" IS NULL OR "expiresAt" > ${new Date()})
      RETURNING "value"
    `;
    return rows[0]?.value ?? null;
  },

  async del(key: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM "KeyValue" WHERE "key" = ${key}`;
  },

  async exists(key: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ one: number }>>`
      SELECT 1 AS one FROM "KeyValue"
      WHERE "key" = ${key} AND ("expiresAt" IS NULL OR "expiresAt" > ${new Date()})
      LIMIT 1
    `;
    return rows.length > 0;
  },

  /**
   * Atomic increment with TTL refresh; returns the new value. An expired
   * counter resets to 1, matching how Redis would have dropped it first.
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const now = new Date();
    const expiresAt = expiryDate(ttlSeconds);
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "KeyValue" ("key", "value", "expiresAt", "updatedAt")
      VALUES (${key}, '1', ${expiresAt}, ${now})
      ON CONFLICT ("key") DO UPDATE
        SET "value" = (
              CASE WHEN "KeyValue"."expiresAt" IS NOT NULL AND "KeyValue"."expiresAt" < ${now}
                   THEN 1
                   ELSE "KeyValue"."value"::int + 1 END
            )::text,
            "expiresAt" = ${expiresAt},
            "updatedAt" = ${now}
      RETURNING "value"
    `;
    return parseInt(rows[0]?.value ?? "1", 10);
  },

  /** Decrement an existing counter; returns the new value (0 if absent). */
  async decr(key: string): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      UPDATE "KeyValue"
      SET "value" = ("KeyValue"."value"::int - 1)::text, "updatedAt" = ${new Date()}
      WHERE "key" = ${key}
      RETURNING "value"
    `;
    return rows.length ? parseInt(rows[0]!.value, 10) : 0;
  },

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "KeyValue" SET "expiresAt" = ${expiryDate(ttlSeconds)} WHERE "key" = ${key}
    `;
  },

  /** Delete expired rows. Called periodically by the background scheduler. */
  async sweepExpired(): Promise<void> {
    await prisma.$executeRaw`
      DELETE FROM "KeyValue" WHERE "expiresAt" IS NOT NULL AND "expiresAt" < ${new Date()}
    `;
  },
};

/** Presence keys: presence:{userId} -> live socket count; TTL-refreshed. */
export const presenceKey = (userId: string) => `presence:${userId}`;
