import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageSquare, Users, Compass, Settings, Shield, Moon, Sun, Hash } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { chatDisplayName, cn } from "@/lib/utils";
import type { Chat } from "@/types";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPalette);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: chats } = useQuery({
    queryKey: ["chats"],
    queryFn: () => api<Chat[]>("/chats"),
    enabled: open,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => {
      navigate(path);
      setOpen(false);
    };
    const base: Command[] = [
      { id: "friends", label: "Open Friends", icon: <Users className="h-4 w-4" />, run: go("/friends") },
      { id: "discover", label: "Discover groups & channels", icon: <Compass className="h-4 w-4" />, run: go("/discover") },
      { id: "settings", label: "Open Settings", icon: <Settings className="h-4 w-4" />, run: go("/settings") },
      {
        id: "theme",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        icon: theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        run: () => {
          setTheme(theme === "dark" ? "light" : "dark");
          setOpen(false);
        },
      },
    ];
    if (user?.role === "ADMIN" || user?.role === "MODERATOR") {
      base.push({ id: "admin", label: "Open Admin dashboard", icon: <Shield className="h-4 w-4" />, run: go("/admin") });
    }
    const chatCommands: Command[] = (chats ?? []).map((c) => ({
      id: `chat-${c.id}`,
      label: chatDisplayName(c, user?.id),
      hint: c.type === "CHANNEL" ? "channel" : c.type === "GROUP" ? "group" : "dm",
      icon: c.type === "DM" ? <MessageSquare className="h-4 w-4" /> : <Hash className="h-4 w-4" />,
      run: go(`/chat/${c.id}`),
    }));
    return [...chatCommands, ...base];
  }, [chats, navigate, setOpen, setTheme, theme, user]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 12);
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 12);
  }, [commands, query]);

  useEffect(() => setIndex(0), [filtered.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      filtered[index]?.run();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[15vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="glass-strong w-full max-w-lg overflow-hidden rounded-2xl"
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Search className="h-4 w-4 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search chats and commands…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
              />
              <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted">No matches for “{query}”</p>
              )}
              {filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={cmd.run}
                  onMouseEnter={() => setIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    i === index ? "bg-primary/15 text-slate-100" : "text-muted hover:text-slate-100"
                  )}
                >
                  <span className={cn("text-muted", i === index && "text-primary-soft")}>{cmd.icon}</span>
                  <span className="flex-1 truncate">{cmd.label}</span>
                  {cmd.hint && <span className="text-[10px] uppercase tracking-wide text-muted/60">{cmd.hint}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
