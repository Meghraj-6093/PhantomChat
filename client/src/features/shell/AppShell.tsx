import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useUiStore } from "@/stores/uiStore";
import { NavRail } from "./NavRail";
import { ChatSidebar } from "./ChatSidebar";
import { MobileNav } from "./MobileNav";

export default function AppShell() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const location = useLocation();

  // Close the mobile drawer on navigation.
  useEffect(() => {
    toggleSidebar(false);
  }, [location.pathname, toggleSidebar]);

  const isChatView = location.pathname.startsWith("/chat/") || location.pathname === "/";

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background bg-gradient-aurora">
      {/* Desktop nav rail */}
      <div className="hidden md:block">
        <NavRail />
      </div>

      {/* Chat list sidebar — persistent on md+, drawer on mobile */}
      <div className="hidden w-[300px] shrink-0 border-r border-line md:block lg:w-[340px]">
        <ChatSidebar />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => toggleSidebar(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[340px] md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.6, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) toggleSidebar(false);
              }}
            >
              <NavRail />
              <div className="glass-strong flex-1">
                <ChatSidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <Outlet />
        {/* Mobile bottom navigation — hidden inside an active chat for immersion */}
        <div className="md:hidden">{!location.pathname.startsWith("/chat/") && <MobileNav />}</div>
      </main>
    </div>
  );
}
