import { cn, initials, avatarGradient } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";

interface AvatarProps {
  src?: string | null;
  name: string;
  userId?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
  status?: string;
  className?: string;
}

const sizes = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
  xl: "h-24 w-24 text-2xl",
};

const dotSizes = { xs: "h-2 w-2", sm: "h-2.5 w-2.5", md: "h-3 w-3", lg: "h-3.5 w-3.5", xl: "h-5 w-5" };

const statusColors: Record<string, string> = {
  ONLINE: "bg-success",
  IDLE: "bg-warning",
  DND: "bg-danger",
  OFFLINE: "bg-slate-500",
  INVISIBLE: "bg-slate-500",
};

export function Avatar({ src, name, userId, size = "md", showStatus, status, className }: AvatarProps) {
  const liveStatus = useChatStore((s) => (userId ? s.presence[userId] : undefined));
  const effective = liveStatus ?? status ?? "OFFLINE";

  return (
    <div className={cn("relative shrink-0", className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          className={cn("rounded-full object-cover ring-1 ring-line", sizes[size])}
        />
      ) : (
        <div
          className={cn("flex items-center justify-center rounded-full font-bold text-white ring-1 ring-line", sizes[size])}
          style={{ background: avatarGradient(name) }}
          aria-label={name}
        >
          {initials(name)}
        </div>
      )}
      {showStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-background",
            dotSizes[size],
            statusColors[effective] ?? "bg-slate-500"
          )}
          title={effective.toLowerCase()}
        />
      )}
    </div>
  );
}
