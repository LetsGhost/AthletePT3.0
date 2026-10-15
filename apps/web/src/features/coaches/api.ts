import type { Coach, CreateCoachRequest, UpdateCoachRequest } from "@athletept/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

const keys = {
  all: ["coaches"] as const,
};

export function useCoaches() {
  return useQuery({ queryKey: keys.all, queryFn: () => api<Coach[]>("/coaches") });
}

export function useCreateCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCoachRequest) =>
      api<Coach & { inviteSent: boolean }>("/coaches", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateCoachRequest & { id: string }) =>
      api<Coach>(`/coaches/${id}`, { method: "PATCH", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useResendCoachInvitation() {
  return useMutation({
    mutationFn: (id: string) =>
      api<{ inviteSent: boolean }>(`/coaches/${id}/invitation`, { method: "POST" }),
  });
}
