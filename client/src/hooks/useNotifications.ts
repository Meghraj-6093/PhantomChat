import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { isSocketLive } from "@/lib/socket";
import type { Notification, Paginated } from "@/types";

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Paginated<Notification>>("/notifications"),
    enabled,
    // Poll while the panel is open and there's no socket, so new
    // notifications appear without closing and reopening it.
    refetchInterval: () => (enabled && !isSocketLive() ? 10_000 : false),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: () => (isSocketLive() ? 60_000 : 15_000),
  });
}

export function useMarkNotificationsRead() {
  return useMutation({
    mutationFn: (ids?: string[]) => api("/notifications/read", { body: { ids } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });
}
