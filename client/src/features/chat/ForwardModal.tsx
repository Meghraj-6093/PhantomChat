import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useChats } from "@/hooks/useChats";
import { useForwardMessage } from "@/hooks/useMessages";
import { useAuthStore } from "@/stores/authStore";
import { chatDisplayName, cn } from "@/lib/utils";
import type { Message } from "@/types";

export function ForwardModal({ open, onClose, message }: { open: boolean; onClose: () => void; message: Message }) {
  const { data: chats } = useChats();
  const user = useAuthStore((s) => s.user);
  const forward = useForwardMessage();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    await forward.mutateAsync({ messageId: message.id, chatId: message.chatId, targetChatIds: selected });
    setSelected([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Forward message">
      <p className="mb-3 truncate rounded-xl border border-line bg-background/40 px-3 py-2 text-xs text-muted">
        {message.content ?? "Attachment"}
      </p>
      <div className="max-h-64 space-y-0.5 overflow-y-auto">
        {(chats ?? [])
          .filter((c) => c.id !== message.chatId)
          .map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition",
                selected.includes(c.id) ? "bg-primary/15 text-primary-soft" : "hover:bg-slate-700/25"
              )}
            >
              <span className="truncate">{chatDisplayName(c, user?.id)}</span>
              {selected.includes(c.id) && <span className="text-xs">✓</span>}
            </button>
          ))}
      </div>
      <Button className="mt-4 w-full" disabled={!selected.length} loading={forward.isPending} onClick={submit}>
        Forward to {selected.length || "…"} chat{selected.length === 1 ? "" : "s"}
      </Button>
    </Modal>
  );
}
