import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessagesSquare, Send, X } from "lucide-react";
import { useMessages, useSendMessage } from "@/hooks/useMessages";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { Avatar } from "@/components/ui/Avatar";
import { renderMarkdown } from "@/lib/markdown";
import { formatMessageTime } from "@/lib/utils";

export function ThreadPanel({ chatId }: { chatId: string }) {
  const threadRoot = useChatStore((s) => s.threadRoot);
  const setThreadRoot = useChatStore((s) => s.setThreadRoot);
  const user = useAuthStore((s) => s.user);
  const { data } = useMessages(chatId, threadRoot?.id ?? null);
  const sendMessage = useSendMessage();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const replies = (data?.pages ?? []).flatMap((p) => p.items);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [replies.length]);

  if (!threadRoot) return null;

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setText("");
    await sendMessage.mutateAsync({ chatId, content, threadRootId: threadRoot.id });
  };

  return (
    <motion.aside
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 350 }}
      className="glass-strong fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-line pt-safe lg:static lg:z-auto lg:w-[320px]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <MessagesSquare className="h-4 w-4 text-primary-soft" /> Thread
        </h3>
        <button onClick={() => setThreadRoot(null)} className="rounded-lg p-1.5 text-muted hover:bg-slate-700/40 hover:text-slate-100" aria-label="Close thread">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Root message */}
      <div className="border-b border-line bg-background/30 p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <Avatar src={threadRoot.sender?.avatarUrl} name={threadRoot.sender?.displayName ?? "?"} size="sm" />
          <span className="text-sm font-semibold">{threadRoot.sender?.displayName}</span>
          <span className="text-[10px] text-muted">{formatMessageTime(threadRoot.createdAt)}</span>
        </div>
        <div className="text-sm">{threadRoot.content && renderMarkdown(threadRoot.content)}</div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto p-3">
        {replies.length === 0 && (
          <p className="py-8 text-center text-xs text-muted">No replies yet. Start the thread! 🧵</p>
        )}
        {replies.map((m) => (
          <div key={m.id} className="mb-3 flex gap-2">
            <Avatar src={m.sender?.avatarUrl} name={m.sender?.displayName ?? "?"} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold">
                  {m.senderId === user?.id ? "You" : m.sender?.displayName}
                </span>
                <span className="text-[10px] text-muted">{formatMessageTime(m.createdAt)}</span>
              </div>
              <div className="text-sm">{m.content && renderMarkdown(m.content)}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className="border-t border-line p-3 pb-safe">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Reply in thread…"
            className="input-base min-h-[40px] resize-none py-2.5"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow disabled:opacity-40"
            aria-label="Send reply"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
