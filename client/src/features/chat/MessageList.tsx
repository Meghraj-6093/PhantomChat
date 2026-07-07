import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { useMessages } from "@/hooks/useMessages";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { MessagesSkeleton } from "@/components/ui/Skeleton";
import { formatDaySeparator, cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { MessageBubble } from "./MessageBubble";
import type { Chat, Message } from "@/types";

const WALLPAPERS: Record<string, string> = {
  aurora:
    "radial-gradient(ellipse 70% 45% at 20% 0%, rgba(99,102,241,0.16), transparent), radial-gradient(ellipse 60% 40% at 85% 100%, rgba(139,92,246,0.14), transparent)",
  ocean:
    "radial-gradient(ellipse 70% 50% at 10% 10%, rgba(14,165,233,0.14), transparent), radial-gradient(ellipse 60% 45% at 90% 90%, rgba(34,197,94,0.10), transparent)",
  sunset:
    "radial-gradient(ellipse 70% 50% at 15% 0%, rgba(239,68,68,0.12), transparent), radial-gradient(ellipse 60% 45% at 85% 100%, rgba(245,158,11,0.12), transparent)",
};

export function MessageList({ chatId, chat }: { chatId: string; chat: Chat | undefined }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(chatId);
  const user = useAuthStore((s) => s.user);
  const wallpaper = useUiStore((s) => s.wallpaper);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const lastMessageIdRef = useRef<string | null>(null);

  const messages = useMemo(() => {
    const all = (data?.pages ?? []).flatMap((p) => p.items);
    // pages come newest-first; items within a page are chronological
    const ordered = [...(data?.pages ?? [])].reverse().flatMap((p) => p.items);
    // de-dupe (socket + ack can both insert)
    const seen = new Set<string>();
    return ordered.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))) || all;
  }, [data]);

  // Auto-scroll on new messages if pinned to bottom or own message.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.id === lastMessageIdRef.current) return;
    lastMessageIdRef.current = last.id;
    if (atBottom || last.senderId === user?.id) {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      if (last.senderId !== user?.id) {
        getSocket()?.emit("message:read", { chatId, messageId: last.id });
        getSocket()?.emit("chat:read", chatId);
      }
    }
  }, [messages, atBottom, chatId, user?.id]);

  // Jump to bottom instantly on chat switch.
  useEffect(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView());
  }, [chatId, isLoading]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 120);
    if (el.scrollTop < 200 && hasNextPage && !isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevHeight + el.scrollTop;
        });
      });
    }
  };

  if (isLoading) return <MessagesSkeleton />;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto px-3 py-4 sm:px-6"
        style={wallpaper && WALLPAPERS[wallpaper] ? { backgroundImage: WALLPAPERS[wallpaper] } : undefined}
      >
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        )}
        {!hasNextPage && messages.length > 0 && (
          <div className="mx-auto my-4 max-w-xs text-center">
            <p className="text-xs text-muted">This is the beginning of the conversation. 👻</p>
          </div>
        )}

        {messages.map((message, i) => {
          const prev = messages[i - 1];
          const showDay =
            !prev || new Date(prev.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
          const grouped =
            !!prev &&
            !showDay &&
            prev.senderId === message.senderId &&
            !message.replyToId &&
            new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;

          return (
            <Fragment key={message.id}>
              {showDay && <DaySeparator date={message.createdAt} />}
              <MessageBubble
                message={message}
                isOwn={message.senderId === user?.id}
                grouped={grouped}
                chat={chat}
              />
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!atBottom && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="glass-strong absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full text-primary-soft shadow-glow"
          aria-label="Jump to latest"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.button>
      )}
    </div>
  );
}

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-line" />
      <span className={cn("rounded-full border border-line bg-card/60 px-3 py-1 text-[10px] font-medium text-muted backdrop-blur")}>
        {formatDaySeparator(date)}
      </span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}
