import type {
  AthleteDetail,
  AthleteListResponse,
  CreateAthleteRequest,
  UpdateAthleteRequest,
} from "@athletept/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const athleteKeys = {
  all: ["athletes"] as const,
  list: () => [...athleteKeys.all, "list"] as const,
  detail: (id: string) => [...athleteKeys.all, "detail", id] as const,
};

export function useAthletes() {
  return useQuery({
    queryKey: athleteKeys.list(),
    queryFn: () => api<AthleteListResponse>("/athletes"),
  });
}

export function useAthlete(id: string) {
  return useQuery({
    queryKey: athleteKeys.detail(id),
    queryFn: () => api<AthleteDetail>(`/athletes/${id}`),
  });
}

/** Nach jeder Änderung: Detail direkt aktualisieren, Liste neu laden. */
function useAthleteMutation<TVariables, TResult extends AthleteDetail = AthleteDetail>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (athlete) => {
      queryClient.setQueryData(athleteKeys.detail(athlete.id), athlete);
      void queryClient.invalidateQueries({ queryKey: athleteKeys.list() });
    },
  });
}

export function useCreateAthlete() {
  return useAthleteMutation((body: CreateAthleteRequest) =>
    api<AthleteDetail & { inviteSent: boolean }>("/athletes", { method: "POST", body }),
  );
}

export function useUpdateAthlete(id: string) {
  return useAthleteMutation((body: UpdateAthleteRequest) =>
    api<AthleteDetail>(`/athletes/${id}`, { method: "PATCH", body }),
  );
}

export function useArchiveAthlete(id: string) {
  return useAthleteMutation(() =>
    api<AthleteDetail>(`/athletes/${id}/archive`, { method: "POST" }),
  );
}

export function useReactivateAthlete(id: string) {
  return useAthleteMutation(() =>
    api<AthleteDetail>(`/athletes/${id}/reactivate`, { method: "POST" }),
  );
}

export function useResendAthleteInvitation(id: string) {
  return useMutation({
    mutationFn: () =>
      api<{ inviteSent: boolean }>(`/athletes/${id}/invitation`, { method: "POST" }),
  });
}

export function useDeleteAthlete(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/athletes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: athleteKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: athleteKeys.list() });
    },
  });
}
