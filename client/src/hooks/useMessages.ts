import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { getSocket, isSocketLive, replaceMessageInCache, upsertMessageInCache } from "@/lib/socket";
import { encryptForChat, cachePlaintext } from "@/lib/encryption";
import { useAuthStore } from "@/stores/authStore";
import type { Attachment, Chat, Message, MessageType, Paginated } from "@/types";

export function useMessages(chatId: string | undefined, threadRootId: string | null = null) {
  return useInfiniteQuery({
    queryKey: ["messages", chatId, threadRootId],
    queryFn: ({ pageParam }) =>
      api<Paginated<Message>>(
        `/chats/${chatId}/messages?limit=50${pageParam ? `&cursor=${pageParam}` : ""}${
          threadRootId ? `&threadRootId=${threadRootId}` : ""
        }`
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!chatId,
    staleTime: 60_000,
    // When there is no live socket (e.g. serverless deploy), poll the open
    // conversation so new messages arrive without a manual refresh. Polling
    // stops automatically once a real socket connects.
    refetchInterval: () => (isSocketLive() ? false : 2500),
    refetchIntervalInBackground: false,
  });
}

interface SendArgs {
  chatId: string;
  content?: string;
  type?: MessageType;
  replyToId?: string;
  threadRootId?: string | null;
  attachments?: Attachment[];
  scheduledFor?: string;
}

/** Optimistic send over the socket with REST fallback. */
export function useSendMessage() {
  return useMutation({
    mutationFn: async (args: SendArgs) => {
      const user = useAuthStore.getState().user;
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Message = {
        id: tempId,
        chatId: args.chatId,
        senderId: user?.id ?? null,
        sender: user,
        type: args.type ?? "TEXT",
        content: args.content ?? null,
        replyToId: args.replyToId ?? null,
        replyTo: null,
        threadRootId: args.threadRootId ?? null,
        isEdited: false,
        isDeleted: false,
        isSent: true,
        scheduledFor: args.scheduledFor ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: args.attachments ?? [],
        reactions: [],
        pending: true,
      };
      if (!args.scheduledFor) upsertMessageInCache(optimistic);

      // Encrypt the text for the chat's members when the conversation is
      // encryptable and our keys are ready; otherwise send as plaintext.
      let outContent = args.content;
      let isEncrypted = false;
      if (args.content) {
        const chat = queryClient.getQueryData<Chat>(["chat", args.chatId]);
        if (chat) {
          const result = await encryptForChat(chat, args.content);
          outContent = result.content;
          isEncrypted = result.isEncrypted;
        }
      }

      const payload = {
        chatId: args.chatId,
        content: outContent,
        isEncrypted,
        type: args.type,
        replyToId: args.replyToId,
        threadRootId: args.threadRootId ?? undefined,
        attachmentIds: args.attachments?.map((a) => a.id),
        scheduledFor: args.scheduledFor,
      };

      const finalize = (real: Message) => {
        // We already hold the plaintext for our own encrypted message.
        if (isEncrypted && args.content) cachePlaintext(real.id, args.content);
        replaceMessageInCache(args.chatId, args.threadRootId ?? null, (m) => m.id === tempId, real);
        // The socket broadcast may also have upserted the real id; drop dupes.
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      };

      const socket = getSocket();
      if (socket?.connected && !args.scheduledFor) {
        return new Promise<Message>((resolve, reject) => {
          const timer = setTimeout(() => fallback(), 5000);
          const fallback = async () => {
            clearTimeout(timer);
            try {
              const real = await api<Message>(`/chats/${args.chatId}/messages`, { body: payload });
              finalize(real);
              resolve(real);
            } catch (err) {
              markFailed();
              reject(err);
            }
          };
          const markFailed = () => {
            replaceMessageInCache(args.chatId, args.threadRootId ?? null, (m) => m.id === tempId, {
              ...optimistic,
              pending: false,
              failed: true,
            });
          };
          socket.emit("message:send", payload, (res: { ok: boolean; data?: Message; error?: string }) => {
            clearTimeout(timer);
            if (res.ok && res.data) {
              finalize(res.data);
              resolve(res.data);
            } else {
              markFailed();
              reject(new Error(res.error ?? "Failed to send"));
            }
          });
        });
      }

      // REST path (scheduled messages or socket down).
      try {
        const real = await api<Message>(`/chats/${args.chatId}/messages`, { body: payload });
        if (!args.scheduledFor) finalize(real);
        return real;
      } catch (err) {
        if (!args.scheduledFor) {
          replaceMessageInCache(args.chatId, args.threadRootId ?? null, (m) => m.id === tempId, {
            ...optimistic,
            pending: false,
            failed: true,
          });
        }
        throw err;
      }
    },
  });
}

export function useEditMessage() {
  return useMutation({
    mutationFn: async ({ chatId, messageId, content }: { chatId: string; messageId: string; content: string }) => {
      // Re-encrypt the edited text so the stored envelope stays valid.
      let outContent = content;
      const chat = queryClient.getQueryData<Chat>(["chat", chatId]);
      const result = chat ? await encryptForChat(chat, content) : { content, isEncrypted: false };
      outContent = result.content;
      const message = await api<Message>(`/chats/${chatId}/messages/${messageId}`, {
        method: "PATCH",
        body: { content: outContent },
      });
      if (result.isEncrypted) cachePlaintext(message.id, content);
      return message;
    },
    onSuccess: (message) => upsertMessageInCache(message),
  });
}

export function useDeleteMessage() {
  return useMutation({
    mutationFn: ({ chatId, messageId }: { chatId: string; messageId: string }) =>
      api<Message>(`/chats/${chatId}/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: (message) => upsertMessageInCache(message),
  });
}

export function useToggleReaction() {
  return useMutation({
    mutationFn: ({ chatId, messageId, emoji }: { chatId: string; messageId: string; emoji: string }) =>
      api<Message>(`/chats/${chatId}/messages/${messageId}/reactions`, { body: { emoji } }),
    onSuccess: (message) => message && upsertMessageInCache(message),
  });
}

export function usePin() {
  return useMutation({
    mutationFn: ({ chatId, messageId, pin }: { chatId: string; messageId: string; pin: boolean }) =>
      pin
        ? api(`/chats/${chatId}/messages/${messageId}/pin`, { method: "POST" })
        : api(`/chats/${chatId}/messages/${messageId}/pin`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pins"] }),
  });
}

export function useForwardMessage() {
  return useMutation({
    mutationFn: ({ messageId, chatId, targetChatIds }: { messageId: string; chatId: string; targetChatIds: string[] }) =>
      api(`/chats/${chatId}/messages/${messageId}/forward`, { body: { targetChatIds } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
}

export async function uploadFiles(files: File[]): Promise<Attachment[]> {
  const formData = new FormData();
  for (const f of files) formData.append("files", f);
  return api<Attachment[]>("/uploads", { formData });
}
