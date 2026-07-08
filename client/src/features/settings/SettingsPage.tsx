import { useState } from "react";
import { motion } from "framer-motion";
import {
  User, Palette, ShieldCheck, MonitorSmartphone, Menu, Moon, Sun, Check, LogOut, KeyRound,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore, type Theme } from "@/stores/uiStore";
import { useUiStore as uiStore } from "@/stores/uiStore";
import { useUpdateProfile } from "./useSettings";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { SecuritySection } from "./SecuritySection";
import { uploadFiles } from "@/hooks/useMessages";

type Tab = "profile" | "appearance" | "security" | "sessions";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
    { id: "security", label: "Security", icon: <ShieldCheck className="h-4 w-4" /> },
    { id: "sessions", label: "Sessions", icon: <MonitorSmartphone className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 pt-safe">
        <button onClick={() => toggleSidebar(true)} className="text-muted md:hidden" aria-label="Menu">
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors active:scale-95",
              tab === t.id ? "text-primary-soft" : "text-muted hover:bg-slate-700/30 hover:text-slate-100"
            )}
          >
            {tab === t.id && (
              <motion.span
                layoutId="settings-tab-pill"
                className="absolute inset-0 rounded-full bg-primary/20"
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            )}
            <span className="relative flex items-center gap-1.5">{t.icon} {t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
        <div className="mx-auto max-w-xl">
          {tab === "profile" && <ProfileSection />}
          {tab === "appearance" && <AppearanceSection />}
          {tab === "security" && <SecuritySection />}
          {tab === "sessions" && <SessionsSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const update = useUpdateProfile();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [statusText, setStatusText] = useState(user?.statusText ?? "");
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  if (!user) return null;

  const save = async () => {
    await update.mutateAsync({ displayName, bio, statusText });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changeAvatar = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setAvatarUploading(true);
      try {
        const [att] = await uploadFiles([file]);
        if (att) await update.mutateAsync({ avatarUrl: att.secureUrl });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Avatar upload failed");
      } finally {
        setAvatarUploading(false);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-5">
      <div className="glass flex items-center gap-4 rounded-2xl p-5">
        <button onClick={changeAvatar} className="group relative" title="Change avatar">
          <Avatar src={user.avatarUrl} name={user.displayName} size="lg" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            {avatarUploading ? "…" : "Edit"}
          </span>
        </button>
        <div>
          <h3 className="text-base font-bold">{user.displayName}</h3>
          <p className="text-sm text-muted">@{user.username} · {user.email}</p>
          {!user.emailVerified && <p className="mt-0.5 text-xs text-warning">Email not verified</p>}
        </div>
      </div>

      <div className="glass space-y-4 rounded-2xl p-5">
        <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={48} />
        <Input label="Status" value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="What's happening?" maxLength={120} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
            className="input-base resize-none"
            placeholder="Tell people about yourself…"
          />
        </div>
        <Button onClick={save} loading={update.isPending} className="w-full">
          {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

const WALLPAPER_OPTIONS = [
  { id: null, label: "None" },
  { id: "aurora", label: "Aurora" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
];

function AppearanceSection() {
  const theme = uiStore((s) => s.theme);
  const setTheme = uiStore((s) => s.setTheme);
  const wallpaper = uiStore((s) => s.wallpaper);
  const setWallpaper = uiStore((s) => s.setWallpaper);

  const themes: Array<{ id: Theme; label: string; icon: React.ReactNode }> = [
    { id: "dark", label: "Dark", icon: <Moon className="h-5 w-5" /> },
    { id: "light", label: "Light", icon: <Sun className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Theme</h3>
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">Ctrl/⌘+Shift+L</kbd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 transition",
                theme === t.id ? "border-primary bg-primary/10 text-primary-soft shadow-glow" : "border-line text-muted hover:border-primary/40"
              )}
            >
              {t.icon}
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="mb-3 text-sm font-bold">Chat wallpaper</h3>
        <div className="grid grid-cols-4 gap-3">
          {WALLPAPER_OPTIONS.map((w) => (
            <button
              key={w.label}
              onClick={() => setWallpaper(w.id)}
              className={cn(
                "flex h-16 items-end justify-center rounded-xl border p-1.5 text-[10px] font-medium transition",
                wallpaper === w.id ? "border-primary shadow-glow" : "border-line hover:border-primary/40",
                w.id === "aurora" && "bg-gradient-to-br from-indigo-500/30 to-violet-500/20",
                w.id === "ocean" && "bg-gradient-to-br from-sky-500/30 to-emerald-500/20",
                w.id === "sunset" && "bg-gradient-to-br from-red-500/30 to-amber-500/20",
                w.id === null && "bg-background"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionsSection() {
  return <SessionsList />;
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

interface Session {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
}

function SessionsList() {
  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api<Session[]>("/auth/sessions"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const revokeAll = useMutation({
    mutationFn: () => api("/auth/sessions", { method: "DELETE" }),
    onSuccess: () => useAuthStore.getState().logout(),
  });

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Active sessions</h3>
          <Button size="sm" variant="danger" onClick={() => confirm("Sign out everywhere?") && revokeAll.mutate()}>
            <LogOut className="h-3.5 w-3.5" /> Sign out all
          </Button>
        </div>
        <div className="space-y-2">
          {sessions?.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <KeyRound className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{parseUserAgent(s.userAgent)}</p>
                <p className="text-[10px] text-muted">
                  {s.ip ?? "unknown IP"} · active {new Date(s.lastUsedAt).toLocaleString()}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>
                Revoke
              </Button>
            </div>
          ))}
          {sessions?.length === 0 && <p className="text-xs text-muted">No active sessions.</p>}
        </div>
      </div>
    </div>
  );
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (ua.includes("Mobile")) return "📱 Mobile browser";
  if (ua.includes("Windows")) return "💻 Windows";
  if (ua.includes("Mac")) return "💻 macOS";
  if (ua.includes("Linux")) return "💻 Linux";
  return ua.slice(0, 60);
}
