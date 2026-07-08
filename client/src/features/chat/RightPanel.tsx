import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { X, Pin, Image as ImageIcon, Users, Info, Crown, Shield, UserMinus, Volume2, Flag } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { chatDisplayName, cn, formatBytes } from "@/lib/utils";
import type { Attachment, Chat, PinnedMessage } from "@/types";

type Tab = "info" | "members" | "pins" | "media";

export function RightPanel({ chat }: { chat: Chat }) {
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("info");

  const name = chatDisplayName(chat, user?.id);
  const canModerate = chat.myRole === "OWNER" || chat.myRole === "ADMIN" || chat.myRole === "MODERATOR";

  const tabs: Array<{ id: Tab; icon: React.ReactNode; label: string }> = [
    { id: "info", icon: <Info className="h-4 w-4" />, label: "Info" },
    { id: "members", icon: <Users className="h-4 w-4" />, label: "Members" },
    { id: "pins", icon: <Pin className="h-4 w-4" />, label: "Pins" },
    { id: "media", icon: <ImageIcon className="h-4 w-4" />, label: "Media" },
  ];

  return (
    <motion.aside
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="glass-strong fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-line pt-safe lg:static lg:z-auto lg:w-[320px]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-bold">Conversation info</h3>
        <button onClick={() => toggleRightPanel(false)} className="rounded-lg p-1.5 text-muted hover:bg-slate-700/40 hover:text-slate-100" aria-label="Close panel">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition",
              tab === t.id ? "border-b-2 border-primary text-primary-soft" : "text-muted hover:text-slate-100"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-safe">
        {tab === "info" && <InfoTab chat={chat} name={name} />}
        {tab === "members" && <MembersTab chat={chat} canModerate={canModerate} />}
        {tab === "pins" && <PinsTab chatId={chat.id} />}
        {tab === "media" && <MediaTab chatId={chat.id} />}
      </div>
    </motion.aside>
  );
}

function InfoTab({ chat, name }: { chat: Chat; name: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-brand text-3xl font-bold text-white shadow-glow">
        {chat.avatarUrl ? (
          <img src={chat.avatarUrl} alt="" className="h-full w-full rounded-3xl object-cover" />
        ) : (
          name[0]?.toUpperCase()
        )}
      </div>
      <div>
        <h4 className="text-lg font-bold">{name}</h4>
        <p className="text-xs uppercase tracking-wide text-muted">
          {chat.type.toLowerCase()} · {chat._count.members} member{chat._count.members === 1 ? "" : "s"}
          {chat.isPublic && " · public"}
        </p>
      </div>
      {chat.description && <p className="text-sm text-muted">{chat.description}</p>}
      {chat.slowModeSeconds > 0 && (
        <p className="rounded-full border border-line px-3 py-1 text-xs text-muted">
          🐢 Slow mode: {chat.slowModeSeconds}s
        </p>
      )}
      <p className="text-[10px] text-muted/60">Created {new Date(chat.createdAt).toLocaleDateString()}</p>
    </div>
  );
}

const roleIcon: Record<string, React.ReactNode> = {
  OWNER: <Crown className="h-3.5 w-3.5 text-warning" />,
  ADMIN: <Shield className="h-3.5 w-3.5 text-primary-soft" />,
  MODERATOR: <Shield className="h-3.5 w-3.5 text-muted" />,
};

function MembersTab({ chat, canModerate }: { chat: Chat; canModerate: boolean }) {
  const user = useAuthStore((s) => s.user);

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    await api(`/chats/${chat.id}/members/${userId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["chat", chat.id] });
    queryClient.invalidateQueries({ queryKey: ["chats"] });
  };

  return (
    <div className="space-y-0.5 p-2">
      {chat.members.map((m) => (
        <div key={m.id} className="group flex items-center gap-3 rounded-xl p-2 hover:bg-slate-700/25">
          <Avatar src={m.user.avatarUrl} name={m.user.displayName} userId={m.userId} size="sm" showStatus status={m.user.status} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              {m.user.displayName}
              {roleIcon[m.role]}
            </p>
            <p className="truncate text-xs text-muted">@{m.user.username}</p>
          </div>
          {canModerate && m.userId !== user?.id && m.role !== "OWNER" && (
            <button
              onClick={() => removeMember(m.userId)}
              className="hidden rounded-lg p-1.5 text-muted transition hover:bg-danger/20 hover:text-danger group-hover:block"
              title="Remove member"
            >
              <UserMinus className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function PinsTab({ chatId }: { chatId: string }) {
  const { data: pins } = useQuery({
    queryKey: ["pins", chatId],
    queryFn: () => api<PinnedMessage[]>(`/chats/${chatId}/messages/pins`),
  });

  if (!pins?.length) {
    return <EmptyState icon={<Pin />} title="No pinned messages" description="Important messages pinned by moderators appear here." />;
  }
  return (
    <div className="space-y-2 p-3">
      {pins.map((pin) => (
        <div key={pin.id} className="glass rounded-xl p-3">
          <div className="mb-1 flex items-center gap-2">
            <Avatar src={pin.message.sender?.avatarUrl} name={pin.message.sender?.displayName ?? "?"} size="xs" />
            <span className="text-xs font-semibold">{pin.message.sender?.displayName}</span>
            <span className="text-[10px] text-muted">{new Date(pin.message.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="line-clamp-3 text-sm text-slate-200">{pin.message.content ?? "Attachment"}</p>
        </div>
      ))}
    </div>
  );
}

function MediaTab({ chatId }: { chatId: string }) {
  const { data: media } = useQuery({
    queryKey: ["media", chatId],
    queryFn: () => api<Attachment[]>(`/chats/${chatId}/messages/media`),
  });

  if (!media?.length) {
    return <EmptyState icon={<ImageIcon />} title="No shared media" description="Photos, videos and files shared in this chat appear here." />;
  }

  const images = media.filter((m) => m.mimeType.startsWith("image/"));
  const others = media.filter((m) => !m.mimeType.startsWith("image/"));

  return (
    <div className="p-3">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((att) => (
            <a key={att.id} href={att.secureUrl} target="_blank" rel="noreferrer">
              <img src={att.secureUrl} alt={att.fileName} loading="lazy" className="aspect-square w-full rounded-lg object-cover transition hover:opacity-80" />
            </a>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {others.map((att) => (
            <a
              key={att.id}
              href={att.secureUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm transition hover:bg-slate-700/25"
            >
              {att.mimeType.startsWith("audio/") ? <Volume2 className="h-4 w-4 text-muted" /> : <Flag className="h-4 w-4 text-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{att.fileName}</p>
                <p className="text-[10px] text-muted">{formatBytes(att.sizeBytes)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
