import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return format(d, "HH:mm");
}

export function formatChatListTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return format(d, "EEE");
  if (isThisYear(d)) return format(d, "d MMM");
  return format(d, "dd/MM/yy");
}

export function formatDaySeparator(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, d MMMM yyyy");
}

export function formatLastSeen(iso: string | null): string {
  if (!iso) return "a while ago";
  const d = new Date(iso);
  if (isToday(d)) return `today at ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `yesterday at ${format(d, "HH:mm")}`;
  return format(d, "d MMM yyyy");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function chatDisplayName(
  chat: { type: string; name: string | null; members: Array<{ userId: string; user: { displayName: string } }> },
  myUserId: string | undefined
): string {
  if (chat.type !== "DM") return chat.name ?? "Unnamed";
  const other = chat.members.find((m) => m.userId !== myUserId);
  return other?.user.displayName ?? "Direct message";
}

export function chatAvatarUser(
  chat: { type: string; avatarUrl?: string | null; members: Array<{ userId: string; user: { avatarUrl: string | null; displayName: string; status?: string } }> },
  myUserId: string | undefined
) {
  if (chat.type !== "DM") return null;
  return chat.members.find((m) => m.userId !== myUserId)?.user ?? null;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic pastel gradient for avatar fallbacks. */
export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${(h + 50) % 360} 70% 55%))`;
}
