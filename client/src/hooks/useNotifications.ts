import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { Notification, Paginated } from "@/types";

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Paginated<Notification>>("/notifications"),
    enabled,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
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
