import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Plus, Search, Hash, Megaphone, Ghost } from "lucide-react";
import { useChats } from "@/hooks/useChats";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore, EMPTY_TYPING } from "@/stores/chatStore";
import { Avatar } from "@/components/ui/Avatar";
import { ChatListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { chatDisplayName, chatAvatarUser, cn, formatChatListTime } from "@/lib/utils";
import { CreateChatModal } from "./CreateChatModal";
import type { Chat } from "@/types";

type Filter = "all" | "dm" | "group" | "channel";

export function ChatSidebar() {
  const { data: chats, isLoading } = useChats();
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let list = chats ?? [];
    if (filter !== "all") {
      list = list.filter((c) => c.type.toLowerCase() === filter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => chatDisplayName(c, user?.id).toLowerCase().includes(q));
    }
    return list;
  }, [chats, filter, query, user?.id]);

  return (
    <div className="flex h-full flex-col pt-safe">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-lg font-bold tracking-tight">Messages</h1>
        <Button size="icon" variant="ghost" onClick={() => setCreateOpen(true)} title="New chat">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="input-base pl-10"
          />
        </div>
      </div>

      <div className="flex gap-1 px-3 pb-2">
        {(["all", "dm", "group", "channel"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition",
              filter === f ? "bg-primary/20 text-primary-soft" : "text-muted hover:bg-slate-700/30"
            )}
          >
            {f === "dm" ? "DMs" : f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading && <ChatListSkeleton />}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            icon={<Ghost />}
            title={query ? "No matches" : "No conversations yet"}
            description={query ? "Try a different search." : "Start a DM or create a group to get chatting."}
            action={
              !query ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> New chat
                </Button>
              ) : undefined
            }
          />
        )}
        {filtered.map((chat) => (
          <ChatRow key={chat.id} chat={chat} myUserId={user?.id} />
        ))}
      </div>

      <CreateChatModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(chat) => {
          setCreateOpen(false);
          navigate(`/chat/${chat.id}`);
        }}
      />
    </div>
  );
}

function ChatRow({ chat, myUserId }: { chat: Chat; myUserId?: string }) {
  const typing = useChatStore((s) => s.typing[chat.id] ?? EMPTY_TYPING);
  const isActive = useChatStore((s) => s.activeChatId === chat.id);
  const name = chatDisplayName(chat, myUserId);
  const dmUser = chatAvatarUser(chat, myUserId);
  const last = chat.lastMessage;

  const preview = typing.length
    ? `${typing[0]!.username} is typing…`
    : last
      ? `${last.senderId === myUserId ? "You: " : ""}${
          last.isDeleted
            ? "Message deleted"
            : last.isEncrypted
              ? "🔒 Encrypted message"
              : (last.content ?? attachmentLabel(last.type))
        }`
      : chat.type === "CHANNEL"
        ? "Channel created"
        : "Say hello 👋";

  return (
      <NavLink
        to={`/chat/${chat.id}`}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-xl p-2.5 transition-all active:scale-[0.98]",
            isActive ? "bg-primary/15" : "hover:bg-slate-700/25"
          )
        }
      >
        {chat.type === "DM" && dmUser ? (
          <Avatar
            src={dmUser.avatarUrl}
            name={dmUser.displayName}
            userId={chat.members.find((m) => m.userId !== myUserId)?.userId}
            size="md"
            showStatus
            status={dmUser.status}
          />
        ) : (
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-soft ring-1 ring-line">
            {chat.avatarUrl ? (
              <img src={chat.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : chat.type === "CHANNEL" ? (
              <Megaphone className="h-5 w-5" />
            ) : (
              <Hash className="h-5 w-5" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold">{name}</span>
            {last && (
              <span className="shrink-0 text-[10px] text-muted">{formatChatListTime(last.createdAt)}</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-xs", typing.length ? "italic text-primary-soft" : "text-muted")}>
              {preview}
            </span>
            {chat.unreadCount > 0 && !isActive && (
              <span className="flex min-w-[18px] shrink-0 items-center justify-center rounded-full bg-gradient-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </NavLink>
  );
}

function attachmentLabel(type: string): string {
  switch (type) {
    case "IMAGE": return "📷 Photo";
    case "VIDEO": return "🎬 Video";
    case "AUDIO":
    case "VOICE": return "🎤 Voice message";
    case "GIF": return "GIF";
    case "STICKER": return "Sticker";
    case "FILE": return "📎 File";
    default: return "Message";
  }
}
