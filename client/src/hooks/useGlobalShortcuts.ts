import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/**
 * App-wide keyboard shortcuts. Theme toggle works everywhere (including the
 * login screen); navigation shortcuts only fire once signed in, since the
 * routes they jump to require auth anyway. Keep SHORTCUT_LIST in lib/shortcuts
 * in sync with the keys handled here.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setShortcutsHelp = useUiStore((s) => s.setShortcutsHelp);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleTheme();
        return;
      }

      if (!mod && !e.shiftKey && !e.altKey && e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setShortcutsHelp(true);
        return;
      }

      if (!user) return;

      if (mod && !e.shiftKey && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        navigate("/friends");
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        navigate("/discover");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, toggleTheme, setShortcutsHelp, user]);
}
