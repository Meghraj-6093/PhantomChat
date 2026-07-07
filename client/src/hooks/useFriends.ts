import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { FriendEntry, PublicUser } from "@/types";

export function useFriends() {
  return useQuery({
    queryKey: ["friends", "list"],
    queryFn: () => api<FriendEntry[]>("/friends"),
  });
}

export function usePendingFriends() {
  return useQuery({
    queryKey: ["friends", "pending"],
    queryFn: () => api<{ incoming: FriendEntry[]; outgoing: FriendEntry[] }>("/friends/pending"),
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
