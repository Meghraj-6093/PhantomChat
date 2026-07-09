import { NavLink, useNavigate } from "react-router-dom";
import { Ghost, MessageSquare, Users, Compass, Settings, Shield, Bell, LogOut, Search } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { usePendingFriends } from "@/hooks/useFriends";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { NotificationPanel } from "./NotificationPanel";

export function NavRail() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setCommandPalette = useUiStore((s) => s.setCommandPalette);
  const navigate = useNavigate();
  const { data: unread } = useUnreadNotificationCount();
  const { data: pending } = usePendingFriends();
  const [notifOpen, setNotifOpen] = useState(false);

  const pendingCount = pending?.incoming.length ?? 0;
  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR";

  const handleLogout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    disconnectSocket();
    logout();
    navigate("/login");
  };

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90",
      isActive
        ? "bg-gradient-brand text-white shadow-glow"
        : "text-muted hover:bg-slate-700/40 hover:text-slate-100"
    );

  return (
    <nav className="no-scrollbar flex h-full w-[68px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-line bg-background/80 py-4 pt-safe backdrop-blur-xl">
      <div className="mb-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
        <Ghost className="h-6 w-6 text-white" />
      </div>

      <NavLink to="/" className={itemClass} title="Chats" end>
        <MessageSquare className="h-5 w-5" />
      </NavLink>

      <NavLink to="/friends" className={itemClass} title="Friends">
        <Users className="h-5 w-5" />
        {pendingCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {pendingCount}
          </span>
        )}
      </NavLink>

      <NavLink to="/discover" className={itemClass} title="Discover">
        <Compass className="h-5 w-5" />
      </NavLink>

      <button
        onClick={() => setNotifOpen(true)}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted transition-all hover:bg-slate-700/40 hover:text-slate-100 active:scale-90"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {(unread?.count ?? 0) > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unread!.count > 99 ? "99+" : unread!.count}
          </span>
        )}
      </button>

      <button
        onClick={() => setCommandPalette(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted transition-all hover:bg-slate-700/40 hover:text-slate-100 active:scale-90"
        title="Search (Ctrl+K)"
      >
        <Search className="h-5 w-5" />
      </button>

      {isStaff && (
        <NavLink to="/admin" className={itemClass} title="Admin">
          <Shield className="h-5 w-5" />
        </NavLink>
      )}

      <div className="flex-1" />

      <NavLink to="/settings" className={itemClass} title="Settings">
        <Settings className="h-5 w-5" />
      </NavLink>

      <button
        onClick={handleLogout}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted transition-all hover:bg-danger/20 hover:text-danger active:scale-90"
        title="Log out"
      >
        <LogOut className="h-5 w-5" />
      </button>

      {user && (
        <NavLink to="/settings" className="mt-1 shrink-0" title={user.displayName}>
          <Avatar src={user.avatarUrl} name={user.displayName} userId={user.id} size="md" showStatus status="ONLINE" />
        </NavLink>
      )}

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </nav>
  );
}
