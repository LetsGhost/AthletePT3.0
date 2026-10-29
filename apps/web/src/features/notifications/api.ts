import type { NotificationListResponse } from "@athletept/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

/** Unter `workouts`, damit ein Training (z. B. Überholen) die Glocke gleich aktualisiert. */
export const notificationKeys = {
  all: ["workouts", "notifications"] as const,
};

/** Neue Benachrichtigungen erscheinen ohne Neuladen der Seite, spätestens nach einer Minute. */
const POLL_MS = 60_000;

export function useNotifications({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => api<NotificationListResponse>("/me/notifications"),
    refetchInterval: POLL_MS,
    enabled,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/me/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
