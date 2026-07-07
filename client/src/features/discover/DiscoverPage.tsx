import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Compass, Hash, Megaphone, Menu, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useJoinChat } from "@/hooks/useChats";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Chat } from "@/types";

type DiscoverChat = Pick<Chat, "id" | "type" | "name" | "description" | "avatarUrl" | "createdAt"> & {
  _count: { members: number };
};

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const navigate = useNavigate();
  const join = useJoinChat();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { data: chats, isLoading } = useQuery({
    queryKey: ["discover", query],
    queryFn: () => api<DiscoverChat[]>(`/chats/discover${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  });

  const handleJoin = async (id: string) => {
    setJoiningId(id);
    try {
      const chat = await join.mutateAsync(id);
      navigate(`/chat/${chat.id}`);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 pt-safe">
        <button onClick={() => toggleSidebar(true)} className="text-muted md:hidden" aria-label="Menu">
          <Menu className="h-6 w-6" />
        </button>
        <Compass className="hidden h-5 w-5 text-primary-soft md:block" />
        <h1 className="text-lg font-bold">Discover</h1>
      </header>

      <div className="border-b border-line p-3">
        <div className="relative mx-auto max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search public groups & channels…"
            className="input-base pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
        <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}

          {!isLoading && !chats?.length && (
            <div className="sm:col-span-2">
              <EmptyState
                icon={<Compass />}
                title="Nothing to discover yet"
                description="Public groups and channels created by the community appear here."
              />
            </div>
          )}

          {chats?.map((chat, i) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4) }}
              className="glass flex flex-col gap-3 rounded-2xl p-4 transition hover:shadow-glow"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary-soft">
                  {chat.avatarUrl ? (
                    <img src={chat.avatarUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
                  ) : chat.type === "CHANNEL" ? (
                    <Megaphone className="h-6 w-6" />
                  ) : (
                    <Hash className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold">{chat.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <Users className="h-3 w-3" /> {chat._count.members} member{chat._count.members === 1 ? "" : "s"}
                    <span className="mx-1">·</span>
                    <span className="capitalize">{chat.type.toLowerCase()}</span>
                  </p>
                </div>
              </div>
              <p className="line-clamp-2 min-h-8 flex-1 text-xs text-muted">
                {chat.description ?? "No description."}
              </p>
              <Button size="sm" className="w-full" loading={joiningId === chat.id} onClick={() => handleJoin(chat.id)}>
                Join
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
