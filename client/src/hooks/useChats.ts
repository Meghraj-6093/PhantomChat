import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { isSocketLive } from "@/lib/socket";
import type { Chat } from "@/types";

export function useChats() {
  return useQuery({
    queryKey: ["chats"],
    queryFn: () => api<Chat[]>("/chats"),
    // Without a live socket, poll so unread badges and last-message previews
    // stay current. Disabled automatically once a socket connects.
    refetchInterval: () => (isSocketLive() ? false : 5000),
    refetchIntervalInBackground: false,
  });
}

export function useChat(chatId: string | undefined) {
  return useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => api<Chat>(`/chats/${chatId}`),
    enabled: !!chatId,
    // Picks up member/role/slow-mode changes made by someone else mid-chat.
    refetchInterval: () => (isSocketLive() ? false : 10_000),
  });
}

export function useCreateDm() {
  return useMutation({
    mutationFn: (userId: string) => api<Chat>("/chats/dm", { body: { userId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
}

export function useCreateGroup() {
  return useMutation({
    mutationFn: (input: {
      type: "GROUP" | "CHANNEL";
      name: string;
      description?: string;
      isPublic?: boolean;
      memberIds?: string[];
    }) => api<Chat>("/chats", { body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
}

export function useJoinChat() {
  return useMutation({
    mutationFn: (chatId: string) => api<Chat>(`/chats/${chatId}/join`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
}
