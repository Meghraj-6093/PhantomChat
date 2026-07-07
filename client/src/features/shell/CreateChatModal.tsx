import { useState } from "react";
import { Hash, Megaphone, MessageSquare, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { useUserSearch } from "@/hooks/useFriends";
import { useCreateDm, useCreateGroup } from "@/hooks/useChats";
import { cn } from "@/lib/utils";
import type { Chat, PublicUser } from "@/types";

type Tab = "dm" | "group" | "channel";

export function CreateChatModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (chat: Chat) => void;
}) {
  const [tab, setTab] = useState<Tab>("dm");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const { data: results } = useUserSearch(query);
  const createDm = useCreateDm();
  const createGroup = useCreateGroup();

  const reset = () => {
    setQuery("");
    setName("");
    setDescription("");
    setSelected([]);
    setIsPublic(false);
  };

  const toggleUser = (u: PublicUser) => {
    setSelected((prev) => (prev.some((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u]));
  };

  const submit = async () => {
    if (tab === "dm") {
      const target = selected[0];
      if (!target) return;
      const chat = await createDm.mutateAsync(target.id);
      reset();
      onCreated(chat);
      return;
    }
    if (!name.trim()) return;
    const chat = await createGroup.mutateAsync({
      type: tab === "group" ? "GROUP" : "CHANNEL",
      name: name.trim(),
      description: description.trim() || undefined,
      isPublic,
      memberIds: selected.map((u) => u.id),
    });
    reset();
    onCreated(chat);
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "dm", label: "Direct", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "group", label: "Group", icon: <Hash className="h-4 w-4" /> },
    { id: "channel", label: "Channel", icon: <Megaphone className="h-4 w-4" /> },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Start a conversation">
      <div className="mb-4 flex gap-1 rounded-xl bg-background/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
              tab === t.id ? "bg-gradient-brand text-white shadow-glow" : "text-muted hover:text-slate-100"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab !== "dm" && (
          <>
            <Input
              label={tab === "group" ? "Group name" : "Channel name"}
              placeholder={tab === "group" ? "Weekend crew" : "announcements"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Description (optional)"
              placeholder="What's this about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded accent-[#6366F1]"
              />
              Public — discoverable by anyone
            </label>
          </>
        )}

        <Input
          label={tab === "dm" ? "Find a user" : "Add members"}
          icon={<Search className="h-4 w-4" />}
          placeholder="Search by username…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <button
                key={u.id}
                onClick={() => toggleUser(u)}
                className="flex items-center gap-1.5 rounded-full bg-primary/20 py-1 pl-1 pr-2.5 text-xs text-primary-soft"
              >
                <Avatar src={u.avatarUrl} name={u.displayName} size="xs" />
                {u.displayName} ✕
              </button>
            ))}
          </div>
        )}

        <div className="max-h-44 space-y-0.5 overflow-y-auto">
          {(results ?? []).map((u) => {
            const isSelected = selected.some((s) => s.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => (tab === "dm" ? setSelected([u]) : toggleUser(u))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl p-2 text-left transition",
                  isSelected ? "bg-primary/15" : "hover:bg-slate-700/25"
                )}
              >
                <Avatar src={u.avatarUrl} name={u.displayName} userId={u.id} size="sm" showStatus status={u.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.displayName}</p>
                  <p className="truncate text-xs text-muted">@{u.username}</p>
                </div>
                {isSelected && <span className="text-xs text-primary-soft">Selected</span>}
              </button>
            );
          })}
          {query.trim().length >= 2 && (results?.length ?? 0) === 0 && (
            <p className="py-3 text-center text-xs text-muted">No users found</p>
          )}
        </div>

        <Button
          className="w-full"
          onClick={submit}
          loading={createDm.isPending || createGroup.isPending}
          disabled={tab === "dm" ? selected.length === 0 : !name.trim()}
        >
          {tab === "dm" ? "Start chatting" : tab === "group" ? "Create group" : "Create channel"}
        </Button>
      </div>
    </Modal>
  );
}
