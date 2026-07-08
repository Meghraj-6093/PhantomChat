import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users, Clock, Ban, MessageSquare, Check, X, Menu, Search } from "lucide-react";
import {
  useBlockedUsers, useFriends, usePendingFriends, useRemoveFriend,
  useRespondFriendRequest, useSendFriendRequest, useUnblockUser,
} from "@/hooks/useFriends";
import { useCreateDm } from "@/hooks/useChats";
import { useUiStore } from "@/stores/uiStore";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { FriendEntry } from "@/types";

type Tab = "all" | "pending" | "blocked" | "add";

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const { data: friends } = useFriends();
  const { data: pending } = usePendingFriends();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const pendingCount = pending?.incoming.length ?? 0;

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: "all", label: "All", icon: <Users className="h-4 w-4" /> },
    { id: "pending", label: "Pending", icon: <Clock className="h-4 w-4" />, badge: pendingCount },
    { id: "blocked", label: "Blocked", icon: <Ban className="h-4 w-4" /> },
    { id: "add", label: "Add friend", icon: <UserPlus className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 pt-safe">
        <button onClick={() => toggleSidebar(true)} className="text-muted md:hidden" aria-label="Menu">
          <Menu className="h-6 w-6" />
        </button>
        <Users className="hidden h-5 w-5 text-primary-soft md:block" />
        <h1 className="text-lg font-bold">Friends</h1>
        <span className="text-sm text-muted">· {friends?.length ?? 0}</span>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
              tab === t.id
                ? t.id === "add"
                  ? "bg-gradient-brand text-white shadow-glow"
                  : "bg-primary/20 text-primary-soft"
                : "text-muted hover:bg-slate-700/30 hover:text-slate-100"
            )}
          >
            {t.icon}
            {t.label}
            {!!t.badge && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24 md:pb-3">
        {tab === "all" && <AllFriends />}
        {tab === "pending" && <PendingRequests />}
        {tab === "blocked" && <BlockedList />}
        {tab === "add" && <AddFriend />}
      </div>
    </div>
  );
}

function AllFriends() {
  const { data: friends, isLoading } = useFriends();
  const createDm = useCreateDm();
  const removeFriend = useRemoveFriend();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filtered = (friends ?? []).filter(
    (f) =>
      !query.trim() ||
      f.user.displayName.toLowerCase().includes(query.toLowerCase()) ||
      f.user.username.toLowerCase().includes(query.toLowerCase())
  );

  if (!isLoading && !friends?.length) {
    return (
      <EmptyState
        icon={<Users />}
        title="No friends yet"
        description="Add friends by username to start chatting, calling and sharing."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search friends…" className="input-base pl-10" />
      </div>
      <div className="space-y-1">
        {filtered.map((f) => (
          <div key={f.friendshipId} className="glass flex items-center gap-3 rounded-2xl p-3">
            <Avatar src={f.user.avatarUrl} name={f.user.displayName} userId={f.user.id} size="md" showStatus status={f.user.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{f.user.displayName}</p>
              <p className="truncate text-xs text-muted">@{f.user.username}{f.user.statusText ? ` · ${f.user.statusText}` : ""}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const chat = await createDm.mutateAsync(f.user.id);
                navigate(`/chat/${chat.id}`);
              }}
            >
              <MessageSquare className="h-4 w-4" /> Message
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Remove friend"
              onClick={() => {
                if (confirm(`Remove ${f.user.displayName} from friends?`)) removeFriend.mutate(f.friendshipId);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingRequests() {
  const { data: pending } = usePendingFriends();
  const respond = useRespondFriendRequest();

  const Section = ({ title, list, incoming }: { title: string; list: FriendEntry[]; incoming: boolean }) => (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title} — {list.length}</h3>
      {list.length === 0 && <p className="text-xs text-muted/60">Nothing here.</p>}
      <div className="space-y-1">
        {list.map((f) => (
          <div key={f.friendshipId} className="glass flex items-center gap-3 rounded-2xl p-3">
            <Avatar src={f.user.avatarUrl} name={f.user.displayName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{f.user.displayName}</p>
              <p className="truncate text-xs text-muted">@{f.user.username}</p>
            </div>
            {incoming ? (
              <>
                <Button size="icon" variant="success" title="Accept" onClick={() => respond.mutate({ id: f.friendshipId, accept: true })}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Decline" onClick={() => respond.mutate({ id: f.friendshipId, accept: false })}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted">Sent</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Section title="Incoming" list={pending?.incoming ?? []} incoming />
      <Section title="Outgoing" list={pending?.outgoing ?? []} incoming={false} />
    </div>
  );
}

function BlockedList() {
  const { data: blocked } = useBlockedUsers();
  const unblock = useUnblockUser();

  if (!blocked?.length) {
    return <EmptyState icon={<Ban />} title="Nobody blocked" description="Blocked users can't message you or send friend requests." />;
  }
  return (
    <div className="mx-auto max-w-2xl space-y-1">
      {blocked.map((f) => (
        <div key={f.friendshipId} className="glass flex items-center gap-3 rounded-2xl p-3">
          <Avatar src={f.user.avatarUrl} name={f.user.displayName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{f.user.displayName}</p>
            <p className="truncate text-xs text-muted">@{f.user.username}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => unblock.mutate(f.user.id)}>
            Unblock
          </Button>
        </div>
      ))}
    </div>
  );
}

function AddFriend() {
  const [username, setUsername] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const sendRequest = useSendFriendRequest();

  const submit = async () => {
    if (!username.trim()) return;
    setFeedback(null);
    try {
      await sendRequest.mutateAsync(username.trim().replace(/^@/, ""));
      setFeedback({ ok: true, msg: `Friend request sent to @${username.trim()}! 🎉` });
      setUsername("");
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : "Failed to send request" });
    }
  };

  return (
    <div className="mx-auto max-w-md pt-8">
      <div className="glass rounded-xl3 p-6">
        <h3 className="mb-1 text-lg font-bold">Add a friend</h3>
        <p className="mb-4 text-sm text-muted">Enter their exact username. They'll get a request to accept.</p>
        <div className="flex gap-2">
          <Input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            icon={<UserPlus className="h-4 w-4" />}
          />
          <Button onClick={submit} loading={sendRequest.isPending} disabled={!username.trim()}>
            Send
          </Button>
        </div>
        {feedback && (
          <p className={cn("mt-3 rounded-xl px-3 py-2 text-xs", feedback.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
            {feedback.msg}
          </p>
        )}
      </div>
    </div>
  );
}
