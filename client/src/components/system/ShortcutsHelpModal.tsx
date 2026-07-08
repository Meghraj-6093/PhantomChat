import { Keyboard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useUiStore } from "@/stores/uiStore";
import { SHORTCUT_LIST } from "@/lib/shortcuts";

export function ShortcutsHelpModal() {
  const open = useUiStore((s) => s.shortcutsHelpOpen);
  const setOpen = useUiStore((s) => s.setShortcutsHelp);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts">
      <div className="flex items-center gap-2 pb-3 text-xs text-muted">
        <Keyboard className="h-4 w-4" />
        Press <kbd className="rounded border border-line px-1.5 py-0.5">?</kbd> anytime to see this list.
      </div>
      <ul className="space-y-2">
        {SHORTCUT_LIST.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-200">{s.label}</span>
            <kbd className="shrink-0 rounded-lg border border-line bg-background/60 px-2 py-1 text-xs font-medium text-muted">
              {s.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
