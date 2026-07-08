import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import {
  SmilePlus, Reply, Pencil, Trash2, Pin, MoreHorizontal, MessagesSquare,
  Check, CheckCheck, Clock, AlertCircle, Download, Forward, Play,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { renderMarkdown } from "@/lib/markdown";
import { cn, formatMessageTime, formatBytes, formatDuration } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { useDeleteMessage, usePin, useToggleReaction, useSendMessage } from "@/hooks/useMessages";
import { replaceMessageInCache } from "@/lib/socket";
import { useCryptoStore } from "@/stores/cryptoStore";
import { decryptInto } from "@/lib/encryption";
import { isEnvelope } from "@/lib/crypto";
import { useAuthStore } from "@/stores/authStore";
import { ForwardModal } from "./ForwardModal";
import type { Chat, Message } from "@/types";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  grouped,
  chat,
}: {
  message: Message;
  isOwn: boolean;
  grouped: boolean;
  chat: Chat | undefined;
}) {
  const [showActions, setShowActions] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const setReplyTo = useChatStore((s) => s.setReplyTo);
  const setEditing = useChatStore((s) => s.setEditing);
  const setThreadRoot = useChatStore((s) => s.setThreadRoot);
  const toggleReaction = useToggleReaction();
  const deleteMessage = useDeleteMessage();
  const pinMutation = usePin();
  const sendMessage = useSendMessage();
  const user = useAuthStore((s) => s.user);

  const retrySend = () => {
    // Drop the failed placeholder and re-send with the same payload.
    replaceMessageInCache(message.chatId, message.threadRootId ?? null, (m) => m.id === message.id, null);
    sendMessage.mutate({
      chatId: message.chatId,
      content: message.content ?? undefined,
      type: message.type,
      replyToId: message.replyToId ?? undefined,
      threadRootId: message.threadRootId ?? undefined,
      attachments: message.attachments,
    });
  };

  const canModerate = chat?.myRole && chat.myRole !== "MEMBER";
  const isThreadReply = !!message.threadRootId;

  if (message.isDeleted) {
    return (
      <div className={cn("flex px-1 py-0.5", isOwn && "justify-end")}>
        <p className="rounded-2xl border border-line/50 px-3 py-1.5 text-xs italic text-muted/60">
          Message deleted
        </p>
      </div>
    );
  }

  const readCount = message._count?.readReceipts ?? 0;
  const threadCount = message._count?.threadReplies ?? 0;

  // Decrypt E2EE messages lazily into the plaintext cache.
  const cryptoStatus = useCryptoStore((s) => s.status);
  const decrypted = useCryptoStore((s) => (message.isEncrypted ? s.plaintext[message.id] : undefined));
  const decryptFailed = useCryptoStore((s) => (message.isEncrypted ? !!s.failed[message.id] : false));
  useEffect(() => {
    if (message.isEncrypted && decrypted === undefined && !decryptFailed && cryptoStatus === "ready") {
      decryptInto(message);
    }
  }, [message, decrypted, decryptFailed, cryptoStatus]);

  const displayContent = message.isEncrypted ? decrypted ?? null : message.content;
  const decrypting = message.isEncrypted && decrypted === undefined && !decryptFailed;

  return (
    <motion.div
      initial={message.pending ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn("group relative flex gap-2.5 px-1", grouped ? "mt-0.5" : "mt-3", isOwn && "flex-row-reverse")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setPickerOpen(false);
      }}
    >
      {/* Avatar column */}
      {!isOwn && (
        <div className="w-9 shrink-0">
          {!grouped && message.sender && (
            <Avatar
              src={message.sender.avatarUrl}
              name={message.sender.displayName}
              userId={message.sender.id}
              size="sm"
            />
          )}
        </div>
      )}

      <div className={cn("min-w-0 max-w-[78%] sm:max-w-[65%]", isOwn && "flex flex-col items-end")}>
        {/* Sender + time header */}
        {!grouped && !isOwn && message.sender && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className="text-xs font-semibold text-accent-soft">{message.sender.displayName}</span>
            <span className="text-[10px] text-muted/70">{formatMessageTime(message.createdAt)}</span>
          </div>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div
            className={cn(
              "mb-1 max-w-full cursor-pointer truncate rounded-lg border-l-2 border-primary/60 bg-slate-700/20 px-2.5 py-1 text-xs text-muted",
              isOwn && "border-accent/60"
            )}
          >
            <span className="font-medium text-primary-soft">
              {message.replyTo.sender?.displayName ?? "Unknown"}:
            </span>{" "}
            {isEnvelope(message.replyTo.content) ? "🔒 Encrypted message" : message.replyTo.content?.slice(0, 80) ?? "attachment"}
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "relative rounded-2xl px-3.5 py-2 text-sm shadow-soft",
            isOwn
              ? "bg-gradient-brand text-white"
              : "glass text-slate-100",
            message.failed && "opacity-60 ring-1 ring-danger"
          )}
        >
          {message.attachments.map((att) => (
            <AttachmentView key={att.id} attachment={att} />
          ))}
          {decrypting ? (
            <span className="inline-flex items-center gap-1 text-xs italic text-muted">
              <Lock className="h-3 w-3" /> Decrypting…
            </span>
          ) : decryptFailed ? (
            <span className="inline-flex items-center gap-1 text-xs italic text-muted">
              <Lock className="h-3 w-3" /> Unable to decrypt this message
            </span>
          ) : (
            displayContent && renderMarkdown(displayContent)
          )}

          <span className={cn("ml-2 inline-flex translate-y-0.5 items-center gap-1 text-[10px]", isOwn ? "text-white/70" : "text-muted/70")}>
            {message.isEdited && <span>edited</span>}
            {(grouped || isOwn) && formatMessageTime(message.createdAt)}
            {isOwn &&
              (message.failed ? (
                <AlertCircle className="h-3 w-3 text-red-300" />
              ) : message.pending ? (
                <Clock className="h-3 w-3" />
              ) : readCount > 0 ? (
                <CheckCheck className="h-3 w-3 text-sky-300" />
              ) : (
                <Check className="h-3 w-3" />
              ))}
          </span>
        </div>

        {/* Failed send — offer a retry */}
        {isOwn && message.failed && (
          <button
            onClick={retrySend}
            className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-300 hover:text-red-200"
          >
            <AlertCircle className="h-3 w-3" />
            Failed to send · Tap to retry
          </button>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", isOwn && "justify-end")}>
            {groupReactions(message.reactions).map(({ emoji, count, mine }) => (
              <button
                key={emoji}
                onClick={() => toggleReaction.mutate({ chatId: message.chatId, messageId: message.id, emoji })}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                  mine(user?.id)
                    ? "border-primary/60 bg-primary/20 text-primary-soft"
                    : "border-line bg-card/60 text-muted hover:border-primary/40"
                )}
              >
                {emoji} <span className="font-medium">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread indicator */}
        {threadCount > 0 && !isThreadReply && (
          <button
            onClick={() => setThreadRoot(message)}
            className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary-soft hover:text-accent-soft"
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            {threadCount} {threadCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {/* Hover actions */}
      {showActions && !message.pending && (
        <div
          className={cn(
            "glass-strong absolute -top-4 z-10 flex items-center gap-0.5 rounded-xl p-1",
            isOwn ? "left-2" : "right-2"
          )}
        >
          {pickerOpen ? (
            QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                className="rounded-lg px-1.5 py-0.5 text-base transition hover:scale-125"
                onClick={() => {
                  toggleReaction.mutate({ chatId: message.chatId, messageId: message.id, emoji: e });
                  setPickerOpen(false);
                }}
              >
                {e}
              </button>
            ))
          ) : (
            <>
              <ActionIcon title="React" onClick={() => setPickerOpen(true)}>
                <SmilePlus className="h-4 w-4" />
              </ActionIcon>
              <ActionIcon title="Reply" onClick={() => setReplyTo(message)}>
                <Reply className="h-4 w-4" />
              </ActionIcon>
              {!isThreadReply && (
                <ActionIcon title="Thread" onClick={() => setThreadRoot(message)}>
                  <MessagesSquare className="h-4 w-4" />
                </ActionIcon>
              )}
              <ActionIcon title="Forward" onClick={() => setForwardOpen(true)}>
                <Forward className="h-4 w-4" />
              </ActionIcon>
              {isOwn && message.content && (
                <ActionIcon title="Edit" onClick={() => setEditing(message)}>
                  <Pencil className="h-4 w-4" />
                </ActionIcon>
              )}
              {canModerate && (
                <ActionIcon
                  title="Pin"
                  onClick={() => pinMutation.mutate({ chatId: message.chatId, messageId: message.id, pin: true })}
                >
                  <Pin className="h-4 w-4" />
                </ActionIcon>
              )}
              {(isOwn || canModerate) && (
                <ActionIcon
                  title="Delete"
                  danger
                  onClick={() => {
                    if (confirm("Delete this message?")) {
                      deleteMessage.mutate({ chatId: message.chatId, messageId: message.id });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </ActionIcon>
              )}
            </>
          )}
        </div>
      )}

      <ForwardModal open={forwardOpen} onClose={() => setForwardOpen(false)} message={message} />
    </motion.div>
  );
});

function ActionIcon({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-lg p-1.5 transition",
        danger ? "text-muted hover:bg-danger/20 hover:text-danger" : "text-muted hover:bg-slate-700/40 hover:text-slate-100"
      )}
    >
      {children}
    </button>
  );
}

function groupReactions(reactions: Message["reactions"]) {
  const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();
  for (const r of reactions) {
    const entry = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, userIds: [] };
    entry.count++;
    entry.userIds.push(r.userId);
    map.set(r.emoji, entry);
  }
  return [...map.values()].map((e) => ({
    ...e,
    mine: (uid?: string) => !!uid && e.userIds.includes(uid),
  }));
}

function AttachmentView({ attachment }: { attachment: Message["attachments"][number] }) {
  const url = attachment.secureUrl || attachment.url;
  if (attachment.mimeType.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1 block">
        <img
          src={url}
          alt={attachment.fileName}
          loading="lazy"
          className="max-h-72 max-w-full rounded-xl object-cover"
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
        />
      </a>
    );
  }
  if (attachment.mimeType.startsWith("video/")) {
    return <video src={url} controls preload="metadata" className="mb-1 max-h-72 max-w-full rounded-xl" />;
  }
  if (attachment.mimeType.startsWith("audio/")) {
    return (
      <div className="mb-1 flex min-w-[220px] items-center gap-2">
        <Play className="h-4 w-4 shrink-0 opacity-70" />
        <audio src={url} controls preload="metadata" className="h-9 w-full max-w-[260px]" />
        {attachment.durationMs && <span className="text-[10px] opacity-70">{formatDuration(attachment.durationMs)}</span>}
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={attachment.fileName}
      className="mb-1 flex items-center gap-3 rounded-xl border border-line bg-background/30 px-3 py-2.5"
    >
      <Download className="h-5 w-5 shrink-0 opacity-80" />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{attachment.fileName}</p>
        <p className="text-[10px] opacity-60">{formatBytes(attachment.sizeBytes)}</p>
      </div>
    </a>
  );
}
