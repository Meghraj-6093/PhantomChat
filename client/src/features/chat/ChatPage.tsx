import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Phone, Video, Info, Pin, Hash, Megaphone, Lock } from "lucide-react";
import { useChat } from "@/hooks/useChats";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore, EMPTY_TYPING } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { Avatar } from "@/components/ui/Avatar";
import { chatDisplayName, chatAvatarUser, cn, formatLastSeen } from "@/lib/utils";
import { getSocket, isSocketLive } from "@/lib/socket";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { RightPanel } from "./RightPanel";
import { ThreadPanel } from "./ThreadPanel";
import { useCall } from "./useCall";
import { CallOverlay } from "./CallOverlay";
import { useSocketLive } from "@/hooks/useSocketLive";
import { chatIsEncryptable } from "@/lib/encryption";
import { useCryptoStore } from "@/stores/cryptoStore";

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const { data: chat, isLoading, error } = useChat(chatId);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const threadRoot = useChatStore((s) => s.threadRoot);
  const typing = useChatStore((s) => (chatId ? s.typing[chatId] : undefined) ?? EMPTY_TYPING);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const call = useCall();
  const socketLive = useSocketLive();
  const cryptoReady = useCryptoStore((s) => s.status === "ready");
  const encrypted = !!chat && chatIsEncryptable(chat) && cryptoReady;

  useEffect(() => {
    setActiveChat(chatId ?? null);
    if (!chatId) return () => setActiveChat(null);

    getSocket()?.emit("chat:read", chatId);

    // No live socket (serverless): clear unread via REST. Re-mark on an
    // interval so messages that arrive while the chat stays open keep
    // advancing lastReadAt — otherwise the badge would reappear on leaving.
    let markInterval: ReturnType<typeof setInterval> | undefined;
    if (!isSocketLive()) {
      const markRead = () =>
        api(`/chats/${chatId}/read`, { method: "POST" })
          .then(() => queryClient.invalidateQueries({ queryKey: ["chats"] }))
          .catch(() => {});
      markRead();
      markInterval = setInterval(markRead, 5000);
    }

    return () => {
      if (markInterval) clearInterval(markInterval);
      setActiveChat(null);
    };
  }, [chatId, setActiveChat]);

  const dmUser = chat ? chatAvatarUser(chat, user?.id) : null;
  const otherDmMember = chat?.members.find((m) => m.userId !== user?.id);
  const name = chat ? chatDisplayName(chat, user?.id) : "";
  const presence = useChatStore((s) => (otherDmMember ? s.presence[otherDmMember.userId] : undefined));
  const dmStatus = presence ?? dmUser?.status ?? "OFFLINE";

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold">Chat unavailable</p>
        <p className="text-sm text-muted">{error instanceof Error ? error.message : "Unknown error"}</p>
        <button onClick={() => navigate("/")} className="text-sm text-primary-soft">← Back to chats</button>
      </div>
    );
  }

  const subtitle =
    typing.length > 0
      ? typing.length === 1
        ? `${typing[0]!.username} is typing…`
        : `${typing.length} people are typing…`
      : chat?.type === "DM"
        ? dmStatus === "ONLINE"
          ? "Online"
          : `Last seen ${formatLastSeen(dmUser?.lastSeenAt ?? null)}`
        : `${chat?._count.members ?? 0} members${chat?.isPublic ? " · public" : ""}`;

  const canPost =
    chat?.type !== "CHANNEL" || (chat.myRole && chat.myRole !== "MEMBER");

  return (
    <div className="flex h-full min-w-0">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="glass z-10 flex items-center gap-3 border-b border-line px-3 py-2.5 pt-safe sm:px-4">
          <button onClick={() => navigate("/")} className="text-muted md:hidden" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>

          {chat &&
            (chat.type === "DM" && dmUser ? (
              <Avatar
                src={dmUser.avatarUrl}
                name={dmUser.displayName}
                userId={otherDmMember?.userId}
                size="md"
                showStatus
                status={dmUser.status}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary-soft ring-1 ring-line">
                {chat.type === "CHANNEL" ? <Megaphone className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
              </div>
            ))}

          <button className="min-w-0 flex-1 text-left" onClick={() => toggleRightPanel()}>
            <h2 className="flex items-center gap-1.5 truncate text-sm font-bold">
              {isLoading ? "…" : name}
              {encrypted && (
                <Lock className="h-3.5 w-3.5 shrink-0 text-success" aria-label="End-to-end encrypted" />
              )}
            </h2>
            <p className={cn("truncate text-xs", typing.length ? "italic text-primary-soft" : "text-muted")}>
              {subtitle}
            </p>
          </button>

          {chat?.type === "DM" && otherDmMember && (
            <>
              <button
                onClick={() => call.startCall(otherDmMember.userId, "audio", dmUser?.displayName ?? name, dmUser?.avatarUrl)}
                disabled={!socketLive}
                className="rounded-xl p-2 text-muted transition hover:bg-slate-700/40 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                title={socketLive ? "Voice call" : "Calls need a live connection (unavailable on this deployment)"}
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                onClick={() => call.startCall(otherDmMember.userId, "video", dmUser?.displayName ?? name, dmUser?.avatarUrl)}
                disabled={!socketLive}
                className="rounded-xl p-2 text-muted transition hover:bg-slate-700/40 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                title={socketLive ? "Video call" : "Calls need a live connection (unavailable on this deployment)"}
              >
                <Video className="h-5 w-5" />
              </button>
            </>
          )}
          <button
            onClick={() => toggleRightPanel()}
            className={cn(
              "rounded-xl p-2 transition hover:bg-slate-700/40",
              rightPanelOpen ? "text-primary-soft" : "text-muted hover:text-slate-100"
            )}
            title="Conversation info"
          >
            <Info className="h-5 w-5" />
          </button>
        </header>

        {/* Messages */}
        {chatId && <MessageList chatId={chatId} chat={chat} />}

        {/* Composer */}
        {chatId &&
          (canPost ? (
            <Composer chatId={chatId} slowModeSeconds={chat?.slowModeSeconds ?? 0} />
          ) : (
            <div className="border-t border-line px-4 py-4 pb-safe text-center text-xs text-muted">
              <Pin className="mr-1 inline h-3.5 w-3.5" />
              Only channel staff can post here
            </div>
          ))}
      </div>

      {/* Right sidebar */}
      <AnimatePresence>{rightPanelOpen && chat && <RightPanel chat={chat} />}</AnimatePresence>

      {/* Thread panel */}
      <AnimatePresence>{threadRoot && chatId && <ThreadPanel chatId={chatId} />}</AnimatePresence>

      {/* Call overlay */}
      <CallOverlay call={call} />
    </div>
  );
}
