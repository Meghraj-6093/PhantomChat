import { NavLink } from "react-router-dom";
import { MessageSquare, Users, Compass, Settings, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useState } from "react";
import { NotificationPanel } from "./NotificationPanel";

export function MobileNav() {
  const { data: unread } = useUnreadNotificationCount();
  const [notifOpen, setNotifOpen] = useState(false);

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition",
      isActive ? "text-primary-soft" : "text-muted"
    );

  return (
    <>
      <motion.nav
        initial={{ y: 64 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="glass-strong fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-line pb-safe pl-safe pr-safe"
      >
        <NavLink to="/" className={itemClass} end>
          <MessageSquare className="h-5 w-5" />
          Chats
        </NavLink>
        <NavLink to="/friends" className={itemClass}>
          <Users className="h-5 w-5" />
          Friends
        </NavLink>
        <NavLink to="/discover" className={itemClass}>
          <Compass className="h-5 w-5" />
          Discover
        </NavLink>
        <button onClick={() => setNotifOpen(true)} className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted">
          <Bell className="h-5 w-5" />
          Alerts
          {(unread?.count ?? 0) > 0 && (
            <span className="absolute right-[calc(50%-16px)] top-1 h-2 w-2 rounded-full bg-danger" />
          )}
        </button>
        <NavLink to="/settings" className={itemClass}>
          <Settings className="h-5 w-5" />
          You
        </NavLink>
      </motion.nav>
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
