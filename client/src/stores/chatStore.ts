import { create } from "zustand";
import type { Message } from "@/types";

interface TypingUser {
  userId: string;
  username: string;
  at: number;
}

// Stable reference so `s.typing[id] ?? EMPTY_TYPING` doesn't create a new
// array on every selector call — a fresh `[]` literal would compare unequal
// to itself each render and force subscribers to re-render on any unrelated
// store update.
export const EMPTY_TYPING: TypingUser[] = [];

interface ChatUiState {
  activeChatId: string | null;
  replyTo: Message | null;
  editing: Message | null;
  threadRoot: Message | null; // open thread panel
  typing: Record<string, TypingUser[]>; // chatId -> users typing
  presence: Record<string, string>; // userId -> status
  setActiveChat: (id: string | null) => void;
  setReplyTo: (m: Message | null) => void;
  setEditing: (m: Message | null) => void;
  setThreadRoot: (m: Message | null) => void;
  setTyping: (chatId: string, user: TypingUser) => void;
  clearTyping: (chatId: string, userId: string) => void;
  setPresence: (userId: string, status: string) => void;
}

export const useChatStore = create<ChatUiState>((set) => ({
  activeChatId: null,
  replyTo: null,
  editing: null,
  threadRoot: null,
  typing: {},
  presence: {},
  setActiveChat: (activeChatId) =>
    set({ activeChatId, replyTo: null, editing: null, threadRoot: null }),
  setReplyTo: (replyTo) => set({ replyTo, editing: null }),
  setEditing: (editing) => set({ editing, replyTo: null }),
  setThreadRoot: (threadRoot) => set({ threadRoot }),
  setTyping: (chatId, user) =>
    set((s) => {
      const list = (s.typing[chatId] ?? []).filter((t) => t.userId !== user.userId);
      return { typing: { ...s.typing, [chatId]: [...list, user] } };
    }),
  clearTyping: (chatId, userId) =>
    set((s) => ({
      typing: { ...s.typing, [chatId]: (s.typing[chatId] ?? []).filter((t) => t.userId !== userId) },
    })),
  setPresence: (userId, status) =>
    set((s) => ({ presence: { ...s.presence, [userId]: status } })),
}));
