import type { Server } from "socket.io";

/**
 * Socket.io server handle shared across modules so REST services can push
 * real-time events without circular imports. Set once at boot.
 */
let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToChat(chatId: string, event: string, payload: unknown) {
  io?.to(`chat:${chatId}`).emit(event, payload);
}
