import { create } from "zustand";
import type { PrivateUser } from "@/types";

interface AuthState {
  user: PrivateUser | null;
  accessToken: string | null;
  hydrated: boolean;
  setAuth: (user: PrivateUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: PrivateUser) => void;
  setHydrated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  hydrated: false,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setHydrated: () => set({ hydrated: true }),
  logout: () => set({ user: null, accessToken: null }),
}));
