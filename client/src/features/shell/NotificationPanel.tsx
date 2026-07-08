import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, X, UserPlus, AtSign, Heart, PhoneMissed } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMarkNotificationsRead, useNotifications } from "@/hooks/useNotifications";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import type { Notification } from "@/types";

const typeIcon: Record<string, React.ReactNode> = {
  FRIEND_REQUEST: <UserPlus className="h-3.5 w-3.5 text-primary-soft" />,
  FRIEND_ACCEPT: <UserPlus className="h-3.5 w-3.5 text-success" />,
  MENTION: <AtSign className="h-3.5 w-3.5 text-accent-soft" />,
  REACTION: <Heart className="h-3.5 w-3.5 text-danger" />,
  CALL_MISSED: <PhoneMissed className="h-3.5 w-3.5 text-danger" />,
};

export function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useNotifications(open);
  const markRead = useMarkNotificationsRead();
  const navigate = useNavigate();

  const openNotification = (n: Notification) => {
    if (!n.isRead) markRead.mutate([n.id]);
    const chatId = n.data?.chatId as string | undefined;
    if (chatId) navigate(`/chat/${chatId}`);
    else if (n.type === "FRIEND_REQUEST" || n.type === "FRIEND_ACCEPT") navigate("/friends");
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="glass-strong fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col pt-safe pr-safe"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Bell className="h-4 w-4 text-primary-soft" /> Notifications
              </h2>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => markRead.mutate(undefined)} title="Mark all read">
                  <CheckCheck className="h-4 w-4" /> Read all
                </Button>
                <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-slate-700/40 hover:text-slate-100" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 pb-safe">
              {isLoading && <p className="p-6 text-center text-sm text-muted">Loading…</p>}
              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <EmptyState icon={<Bell />} title="All caught up" description="New mentions, friend requests and reactions land here." />
              )}
              {data?.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-slate-700/25 ${
                    n.isRead ? "opacity-60" : ""
                  }`}
                >
                  <div className="relative">
                    <Avatar src={n.actor?.avatarUrl} name={n.actor?.displayName ?? "System"} size="sm" />
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5">
                      {typeIcon[n.type] ?? <Bell className="h-3.5 w-3.5 text-muted" />}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {n.actor && <span className="font-semibold">{n.actor.displayName} </span>}
                      <span className="text-slate-300">{n.title}</span>
                    </p>
                    {n.body && <p className="truncate text-xs text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-[10px] text-muted/70">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
