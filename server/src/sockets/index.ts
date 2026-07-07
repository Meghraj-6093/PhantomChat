import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { redis, presenceKey } from "../lib/redis";
import { verifyAccessToken, type AccessTokenPayload } from "../utils/jwt";
import { setIo } from "./emitter";
import { registerChatHandlers } from "./chat.handlers";
import { registerCallHandlers } from "./call.handlers";

export interface AuthedSocket extends Socket {
  data: { auth: AccessTokenPayload };
}

const PRESENCE_TTL = 90; // seconds; refreshed by heartbeat

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    path: "/socket.io",
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e6,
  });
  setIo(io);

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);
      if (!token) return next(new Error("unauthorized"));
      socket.data.auth = verifyAccessToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const authed = socket as AuthedSocket;
    const userId = authed.data.auth.sub;
    logger.debug({ userId, socketId: socket.id }, "socket connected");

    socket.join(`user:${userId}`);

    // Join rooms for every chat the user belongs to.
    const memberships = await prisma.chatMember.findMany({ where: { userId }, select: { chatId: true } });
    for (const m of memberships) socket.join(`chat:${m.chatId}`);

    await goOnline(io, userId);

    socket.on("presence:heartbeat", async () => {
      await redis.expire(presenceKey(userId), PRESENCE_TTL);
    });

    socket.on("presence:set", async (status: string) => {
      if (!["ONLINE", "IDLE", "DND", "INVISIBLE"].includes(status)) return;
      await prisma.user.update({ where: { id: userId }, data: { status: status as "ONLINE" } }).catch(() => {});
      io.emit("presence:update", { userId, status });
    });

    registerChatHandlers(io, authed);
    registerCallHandlers(io, authed);

    socket.on("disconnect", async () => {
      logger.debug({ userId, socketId: socket.id }, "socket disconnected");
      await goOffline(io, userId);
    });
  });

  return io;
}

async function goOnline(io: Server, userId: string) {
  const count = await redis.incr(presenceKey(userId));
  await redis.expire(presenceKey(userId), PRESENCE_TTL);
  if (count === 1) {
    await prisma.user
      .update({ where: { id: userId }, data: { status: "ONLINE", lastSeenAt: new Date() } })
      .catch(() => {});
    io.emit("presence:update", { userId, status: "ONLINE" });
  }
}

async function goOffline(io: Server, userId: string) {
  const count = await redis.decr(presenceKey(userId));
  if (count <= 0) {
    await redis.del(presenceKey(userId));
    await prisma.user
      .update({ where: { id: userId }, data: { status: "OFFLINE", lastSeenAt: new Date() } })
      .catch(() => {});
    io.emit("presence:update", { userId, status: "OFFLINE", lastSeenAt: new Date().toISOString() });
  }
}
