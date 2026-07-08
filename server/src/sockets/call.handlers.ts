import type { Server } from "socket.io";
import type { AuthedSocket } from "./index";
import { prisma } from "../lib/prisma";
import { kv } from "../lib/kv";
import { createNotification } from "../modules/notifications/notifications.service";

/**
 * WebRTC signaling relay for 1:1 audio/video calls and screen sharing.
 * Media flows peer-to-peer; the server only relays SDP offers/answers and
 * ICE candidates, and tracks ringing state in the key-value store.
 */
export function registerCallHandlers(io: Server, socket: AuthedSocket) {
  const userId = socket.data.auth.sub;
  const callKey = (a: string, b: string) => `call:${[a, b].sort().join(":")}`;

  socket.on("call:initiate", async (payload: { targetUserId: string; kind: "audio" | "video"; offer: unknown }) => {
    const online = await kv.exists(`presence:${payload.targetUserId}`);
    if (!online) {
      socket.emit("call:unavailable", { targetUserId: payload.targetUserId });
      await createNotification({
        recipientId: payload.targetUserId,
        actorId: userId,
        type: "CALL_MISSED",
        title: "Missed call",
      });
      return;
    }
    await kv.set(callKey(userId, payload.targetUserId), "ringing", { ttl: 60 });
    const caller = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    io.to(`user:${payload.targetUserId}`).emit("call:incoming", {
      from: caller,
      kind: payload.kind,
      offer: payload.offer,
    });
  });

  socket.on("call:answer", async (payload: { targetUserId: string; answer: unknown }) => {
    await kv.set(callKey(userId, payload.targetUserId), "active", { ttl: 60 * 60 * 4 });
    io.to(`user:${payload.targetUserId}`).emit("call:answered", { from: userId, answer: payload.answer });
  });

  socket.on("call:decline", async (payload: { targetUserId: string }) => {
    await kv.del(callKey(userId, payload.targetUserId));
    io.to(`user:${payload.targetUserId}`).emit("call:declined", { from: userId });
  });

  socket.on("call:ice", (payload: { targetUserId: string; candidate: unknown }) => {
    io.to(`user:${payload.targetUserId}`).emit("call:ice", { from: userId, candidate: payload.candidate });
  });

  socket.on("call:end", async (payload: { targetUserId: string }) => {
    await kv.del(callKey(userId, payload.targetUserId));
    io.to(`user:${payload.targetUserId}`).emit("call:ended", { from: userId });
  });

  // Renegotiation (e.g. toggling screen share adds a track).
  socket.on("call:renegotiate", (payload: { targetUserId: string; offer: unknown }) => {
    io.to(`user:${payload.targetUserId}`).emit("call:renegotiate", { from: userId, offer: payload.offer });
  });

  socket.on("call:renegotiate_answer", (payload: { targetUserId: string; answer: unknown }) => {
    io.to(`user:${payload.targetUserId}`).emit("call:renegotiate_answer", { from: userId, answer: payload.answer });
  });
}
