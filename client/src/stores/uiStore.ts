import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;       // mobile drawer
  rightPanelOpen: boolean;    // conversation info panel
  commandPaletteOpen: boolean;
  shortcutsHelpOpen: boolean;
  wallpaper: string | null;   // chat background preset id
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: (open?: boolean) => void;
  toggleRightPanel: (open?: boolean) => void;
  setCommandPalette: (open: boolean) => void;
  setShortcutsHelp: (open: boolean) => void;
  setWallpaper: (w: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      sidebarOpen: false,
      rightPanelOpen: false,
      commandPaletteOpen: false,
      shortcutsHelpOpen: false,
      wallpaper: null,
      setTheme: (theme) => {
        document.documentElement.classList.toggle("light", theme === "light");
        document.documentElement.classList.toggle("dark", theme === "dark");
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
      toggleSidebar: (open) => set({ sidebarOpen: open ?? !get().sidebarOpen }),
      toggleRightPanel: (open) => set({ rightPanelOpen: open ?? !get().rightPanelOpen }),
      setCommandPalette: (commandPaletteOpen) => set({ commandPaletteOpen }),
      setShortcutsHelp: (shortcutsHelpOpen) => set({ shortcutsHelpOpen }),
      setWallpaper: (wallpaper) => set({ wallpaper }),
    }),
    {
      name: "phantom-ui",
      partialize: (s) => ({ theme: s.theme, wallpaper: s.wallpaper }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.classList.toggle("light", state.theme === "light");
          document.documentElement.classList.toggle("dark", state.theme === "dark");
        }
      },
    }
  )
);
