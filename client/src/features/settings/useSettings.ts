import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { PrivateUser } from "@/types";

interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  statusText?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  status?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api<PrivateUser>("/users/me", { method: "PATCH", body: input }),
    onSuccess: (user) => setUser(user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api("/users/me/password", { body: input }),
  });
}
