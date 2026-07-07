import type { Server } from "socket.io";
import type { AuthedSocket } from "./index";
import * as messagesService from "../modules/messages/messages.service";
import * as chatsService from "../modules/chats/chats.service";
import { logger } from "../lib/logger";

interface Ack {
  (response: { ok: boolean; data?: unknown; error?: string }): void;
}

const asAck = (cb: unknown): Ack => (typeof cb === "function" ? (cb as Ack) : () => {});

/**
 * Real-time chat events. Message fan-out happens inside the services via the
 * shared emitter, so REST and socket sends behave identically.
 */
export function registerChatHandlers(io: Server, socket: AuthedSocket) {
  const userId = socket.data.auth.sub;

  socket.on("message:send", async (payload: { chatId: string } & messagesService.SendMessageInput, cb?: unknown) => {
    const ack = asAck(cb);
    try {
      const message = await messagesService.sendMessage(payload.chatId, userId, payload);
      ack({ ok: true, data: message });
    } catch (err) {
      logger.debug({ err }, "message:send failed");
      ack({ ok: false, error: err instanceof Error ? err.message : "Failed to send" });
    }
  });

  socket.on("typing:start", async (chatId: string) => {
    socket.to(`chat:${chatId}`).emit("typing:start", { chatId, userId, username: socket.data.auth.username });
  });

  socket.on("typing:stop", (chatId: string) => {
    socket.to(`chat:${chatId}`).emit("typing:stop", { chatId, userId });
  });

  socket.on("message:read", async (payload: { chatId: string; messageId: string }) => {
    try {
      await messagesService.markRead(payload.chatId, userId, payload.messageId);
    } catch {
      /* non-member; ignore */
    }
  });

  socket.on("chat:read", async (chatId: string) => {
    try {
      await chatsService.markChatRead(chatId, userId);
    } catch {
      /* ignore */
    }
  });

  socket.on("chat:join_room", async (chatId: string) => {
    try {
      await chatsService.assertMember(chatId, userId);
      socket.join(`chat:${chatId}`);
    } catch {
      /* not a member */
    }
  });
}
