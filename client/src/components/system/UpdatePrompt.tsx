import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function UpdatePrompt() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onUpdate = () => setNeedsUpdate(true);
    const onOfflineReady = () => {
      setOfflineReady(true);
      setTimeout(() => setOfflineReady(false), 4000);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("phantom:sw-update", onUpdate);
    window.addEventListener("phantom:sw-offline-ready", onOfflineReady);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("phantom:sw-update", onUpdate);
      window.removeEventListener("phantom:sw-offline-ready", onOfflineReady);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {!online && (
          <motion.div
            initial={{ y: -48 }}
            animate={{ y: 0 }}
            exit={{ y: -48 }}
            className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-warning/90 py-1.5 pt-safe text-xs font-medium text-black"
          >
            <WifiOff className="h-3.5 w-3.5" /> You're offline — showing cached messages
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {(needsUpdate || offlineReady) && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="glass-strong fixed bottom-20 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl p-4 sm:bottom-6"
          >
            <RefreshCw className="h-5 w-5 shrink-0 text-primary-soft" />
            <div className="flex-1 text-sm">
              {needsUpdate ? "A new version of PhantomChat is available." : "PhantomChat is ready to work offline. ✨"}
            </div>
            {needsUpdate && (
              <Button
                size="sm"
                onClick={() =>
                  (window as unknown as { __updateSW?: (r?: boolean) => Promise<void> }).__updateSW?.(true)
                }
              >
                Update
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
