import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Ghost, MessageSquarePlus, Menu, Sparkles, Command } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUiStore } from "@/stores/uiStore";
import { useState } from "react";
import { CreateChatModal } from "@/features/shell/CreateChatModal";

export default function EmptyChatPage() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setCommandPalette = useUiStore((s) => s.setCommandPalette);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative flex h-full flex-col">
      {/* Mobile top bar */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 pt-safe md:hidden">
        <button onClick={() => toggleSidebar(true)} className="text-muted" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-lg font-bold">PhantomChat</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-24 text-center md:pb-6">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-brand shadow-glow">
            <Ghost className="h-12 w-12 text-white" />
          </div>
          <motion.div
            className="absolute -right-2 -top-2"
            animate={{ rotate: [0, 12, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <Sparkles className="h-6 w-6 text-accent-soft" />
          </motion.div>
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold">Your space awaits</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Pick a conversation from the sidebar, or start something new. Groups, channels, voice notes,
            calls — it's all here.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => setCreateOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" /> New conversation
          </Button>
          <Button variant="secondary" onClick={() => setCommandPalette(true)}>
            <Command className="h-4 w-4" /> Quick switcher
            <kbd className="ml-1 rounded border border-line px-1.5 text-[10px] text-muted">Ctrl K</kbd>
          </Button>
        </div>
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
