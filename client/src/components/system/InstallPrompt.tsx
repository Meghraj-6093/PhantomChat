import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "phantom-install-dismissed";
const IOS_DISMISS_KEY = "phantom-ios-install-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as Mac; distinguish by touch support.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /webkit/i.test(ua);
  const otherBrowser = /crios|fxios|edgios|opios/i.test(ua); // Chrome/FF/Edge/Opera on iOS
  return iOS && webkit && !otherBrowser;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);

  // Chromium/Android: native install prompt.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setTimeout(() => setVisible(true), 6000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // iOS Safari never fires beforeinstallprompt, so show manual instructions.
  useEffect(() => {
    if (localStorage.getItem(IOS_DISMISS_KEY)) return;
    if (isStandalone() || !isIosSafari()) return;
    const t = setTimeout(() => setIosVisible(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const dismissIos = () => {
    localStorage.setItem(IOS_DISMISS_KEY, "1");
    setIosVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && deferred && (
        <motion.div
          key="install"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          className="glass-strong fixed bottom-24 left-1/2 z-[65] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Install PhantomChat</p>
            <p className="text-xs text-muted">Faster access, offline chats, native feel.</p>
          </div>
          <Button size="sm" onClick={install}>Install</Button>
          <button
            onClick={dismiss}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-slate-700/40 hover:text-slate-100 active:scale-90"
            aria-label="Dismiss install prompt"
          >
            <X className="h-5 w-5" />
          </button>
        </motion.div>
      )}

      {iosVisible && (
        <motion.div
          key="ios-install"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          className="glass-strong fixed bottom-24 left-1/2 z-[65] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-2xl p-4 sm:bottom-6"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Install PhantomChat</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
              Tap
              <Share className="inline h-3.5 w-3.5 text-primary-soft" />
              <span className="font-medium text-slate-200">Share</span>, then
              <Plus className="inline h-3.5 w-3.5 text-primary-soft" />
              <span className="font-medium text-slate-200">Add to Home Screen</span>.
            </p>
            <button onClick={dismissIos} className="mt-2 text-xs font-medium text-primary-soft hover:underline">
              Not now
            </button>
          </div>
          <button
            onClick={dismissIos}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-slate-700/40 hover:text-slate-100 active:scale-90"
            aria-label="Dismiss install prompt"
          >
            <X className="h-5 w-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
