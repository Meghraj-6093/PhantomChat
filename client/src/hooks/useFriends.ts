import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { isSocketLive } from "@/lib/socket";
import type { FriendEntry, PublicUser } from "@/types";

export function useFriends() {
  return useQuery({
    queryKey: ["friends", "list"],
    queryFn: () => api<FriendEntry[]>("/friends"),
    // No live socket (serverless): poll so a friend coming online/offline or
    // being removed elsewhere shows up without a manual refresh.
    refetchInterval: () => (isSocketLive() ? false : 15_000),
  });
}

export function usePendingFriends() {
  return useQuery({
    queryKey: ["friends", "pending"],
    queryFn: () => api<{ incoming: FriendEntry[]; outgoing: FriendEntry[] }>("/friends/pending"),
    // This drives the NavRail badge, which is always mounted — poll for new
    // incoming requests when there's no socket to push them.
    refetchInterval: () => (isSocketLive() ? false : 10_000),
  });
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: ["friends", "blocked"],
    queryFn: () => api<FriendEntry[]>("/friends/blocked"),
  });
}

const invalidateFriends = () => queryClient.invalidateQueries({ queryKey: ["friends"] });

export function useSendFriendRequest() {
  return useMutation({
    mutationFn: (username: string) => api("/friends/requests", { body: { username } }),
    onSuccess: invalidateFriends,
  });
}

export function useRespondFriendRequest() {
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api(`/friends/requests/${id}/respond`, { body: { accept } }),
    onSuccess: invalidateFriends,
  });
}

export function useRemoveFriend() {
  return useMutation({
    mutationFn: (friendshipId: string) => api(`/friends/${friendshipId}`, { method: "DELETE" }),
    onSuccess: invalidateFriends,
  });
}

export function useBlockUser() {
  return useMutation({
    mutationFn: (userId: string) => api("/friends/block", { body: { userId } }),
    onSuccess: invalidateFriends,
  });
}

export function useUnblockUser() {
  return useMutation({
    mutationFn: (userId: string) => api("/friends/unblock", { body: { userId } }),
    onSuccess: invalidateFriends,
  });
}

export function useUserSearch(q: string) {
  return useQuery({
    queryKey: ["user-search", q],
    queryFn: () => api<PublicUser[]>(`/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}
