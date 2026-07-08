const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);

/** Display-only chord label, e.g. "⌘K" on Mac / "Ctrl+K" elsewhere. */
export function modKey(): string {
  return isMac ? "⌘" : "Ctrl";
}

export interface ShortcutEntry {
  keys: string;
  label: string;
}

/** Single source of truth for the help modal — keep in sync with useGlobalShortcuts. */
export const SHORTCUT_LIST: ShortcutEntry[] = [
  { keys: `${modKey()}+K`, label: "Open quick switcher / command palette" },
  { keys: `${modKey()}+Shift+L`, label: "Toggle dark / light theme" },
  { keys: `${modKey()}+,`, label: "Open settings" },
  { keys: `${modKey()}+Shift+F`, label: "Open friends" },
  { keys: `${modKey()}+Shift+G`, label: "Open discover" },
  { keys: "Esc", label: "Close the open modal or panel" },
  { keys: "?", label: "Show this shortcuts list" },
];
