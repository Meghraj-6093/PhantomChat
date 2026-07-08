import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { queryClient } from "@/lib/queryClient";
import type { Chat, Message, Notification, Paginated } from "@/types";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "/";

let socket: Socket | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

export function getSocket(): Socket | null {
  return socket;
}

/**
 * True only when a live Socket.io connection is established. On serverless
 * hosts (e.g. Vercel) there is no persistent socket server, so this stays
 * false and the data hooks fall back to polling for near-real-time updates.
 */
export function isSocketLive(): boolean {
  return socket?.connected === true;
}

export function connectSocket() {
  const token = useAuthStore.getState().accessToken;
  if (!token || socket?.connected) return socket;

  disconnectSocket();
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelayMax: 10_000,
  });

  socket.on("connect_error", async (err) => {
    if (err.message === "unauthorized") {
      const { refreshAccessToken } = await import("@/lib/api");
      const newToken = await refreshAccessToken();
      if (newToken && socket) {
        (socket.auth as { token: string }).token = newToken;
        socket.connect();
      }
    }
  });

  heartbeat = setInterval(() => socket?.emit("presence:heartbeat"), 45_000);
  registerListeners(socket);
  return socket;
}

export function disconnectSocket() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

// ─────────────────── cache integration ───────────────────

type MessagePages = { pages: Paginated<Message>[]; pageParams: unknown[] };

function upsertMessageInCache(message: Message) {
  const key = ["messages", message.chatId, message.threadRootId ?? null];
  queryClient.setQueryData<MessagePages>(key, (old) => {
    if (!old) return old;
    const pages = old.pages.map((p, i) => {
      // newest page is index 0 (we fetch descending, render reversed)
      let found = false;
      const items = p.items.map((m) => {
        if (m.id === message.id) {
          found = true;
          return message;
        }
        return m;
      });
      if (!found && i === 0) {
        // avoid duplicating an optimistic message with same nonce in content
        return { ...p, items: [...items, message] };
      }
      return { ...p, items };
    });
    return { ...old, pages };
  });
}

function replaceMessageInCache(chatId: string, threadRootId: string | null, matcher: (m: Message) => boolean, replacement: Message | null) {
  const key = ["messages", chatId, threadRootId];
  queryClient.setQueryData<MessagePages>(key, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((p) => ({
        ...p,
        items: replacement
          ? p.items.map((m) => (matcher(m) ? replacement : m))
          : p.items.filter((m) => !matcher(m)),
      })),
    };
  });
}

export { upsertMessageInCache, replaceMessageInCache };

function registerListeners(s: Socket) {
  const chatStore = useChatStore.getState;

  s.on("message:new", (message: Message) => {
    // Skip if this is our own message already applied via ack (id match handles it).
    upsertMessageInCache(message);
    queryClient.invalidateQueries({ queryKey: ["chats"] });
    chatStore().clearTyping(message.chatId, message.senderId ?? "");

    // Browser notification when the tab is hidden.
    if (document.hidden && message.sender && message.senderId !== useAuthStore.getState().user?.id) {
      notify(message.sender.displayName, message.content ?? "Sent an attachment", message.chatId);
    }
  });

  s.on("message:updated", (message: Message | null) => {
    if (message) upsertMessageInCache(message);
  });

  s.on("message:deleted", ({ message }: { message: Message }) => {
    if (message) upsertMessageInCache(message);
    queryClient.invalidateQueries({ queryKey: ["chats"] });
  });

  s.on("message:pinned", () => {
    queryClient.invalidateQueries({ queryKey: ["pins"] });
  });
  s.on("message:unpinned", () => {
    queryClient.invalidateQueries({ queryKey: ["pins"] });
  });
  s.on("message:read", () => {
    // Read receipts are aggregated in _count; cheap refetch of open chat is fine.
  });

  s.on("typing:start", (p: { chatId: string; userId: string; username: string }) => {
    if (p.userId === useAuthStore.getState().user?.id) return;
    chatStore().setTyping(p.chatId, { userId: p.userId, username: p.username, at: Date.now() });
    setTimeout(() => chatStore().clearTyping(p.chatId, p.userId), 6000);
  });
  s.on("typing:stop", (p: { chatId: string; userId: string }) => {
    chatStore().clearTyping(p.chatId, p.userId);
  });

  s.on("presence:update", (p: { userId: string; status: string }) => {
    chatStore().setPresence(p.userId, p.status);
  });

  s.on("chat:new", (chat: Chat) => {
    queryClient.invalidateQueries({ queryKey: ["chats"] });
    s.emit("chat:join_room", chat.id);
  });
  s.on("chat:updated", () => queryClient.invalidateQueries({ queryKey: ["chats"] }));
  s.on("chat:removed", () => queryClient.invalidateQueries({ queryKey: ["chats"] }));
  s.on("chat:member_left", () => queryClient.invalidateQueries({ queryKey: ["chats"] }));
  s.on("chat:member_updated", () => queryClient.invalidateQueries({ queryKey: ["chats"] }));

  s.on("notification:new", (n: Notification) => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    if (n.type === "FRIEND_REQUEST" || n.type === "FRIEND_ACCEPT") {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    }
    if (document.hidden) notify(n.title, n.body ?? "");
  });

  s.on("auth:force_logout", () => {
    useAuthStore.getState().logout();
    disconnectSocket();
  });
}

function notify(title: string, body: string, chatId?: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body: body.slice(0, 120), icon: "/icons/icon-192.png", tag: chatId });
    n.onclick = () => {
      window.focus();
      if (chatId) window.location.href = `/chat/${chatId}`;
    };
  } catch {
    /* mobile: needs SW-based notifications */
  }
}
