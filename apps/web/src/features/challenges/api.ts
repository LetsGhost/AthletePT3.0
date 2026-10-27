import type {
  ChallengeDetail,
  ChallengeListResponse,
  CreateCoachChallengeRequest,
  UpdateCoachChallengeRequest,
} from "@athletept/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

/** Unter `workouts`, damit ein abgeschlossenes Training den Stand automatisch neu lädt. */
export const challengeKeys = {
  all: ["workouts", "challenges"] as const,
  mine: () => [...challengeKeys.all, "mine"] as const,
  myDetail: (id: string) => [...challengeKeys.mine(), id] as const,
  coach: () => [...challengeKeys.all, "coach"] as const,
  coachDetail: (id: string) => [...challengeKeys.coach(), id] as const,
  athlete: (athleteId: string) => [...challengeKeys.all, "athlete", athleteId] as const,
};

const path = (id: string) => encodeURIComponent(id);

export function useMyChallenges() {
  return useQuery({
    queryKey: challengeKeys.mine(),
    queryFn: () => api<ChallengeListResponse>("/me/challenges"),
  });
}

export function useMyChallenge(id: string) {
  return useQuery({
    queryKey: challengeKeys.myDetail(id),
    queryFn: () => api<ChallengeDetail>(`/me/challenges/${path(id)}`),
  });
}

/** Tageswert einer freien Vorgabe (nur heute). */
export function useSetMyEntry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, value }: { date: string; value: number }) =>
      api<ChallengeDetail>(`/me/challenges/${path(id)}/entries/${date}`, {
        method: "PUT",
        body: { value },
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(challengeKeys.myDetail(id), detail);
      void queryClient.invalidateQueries({ queryKey: challengeKeys.mine(), exact: true });
    },
  });
}

export function useCoachChallenges() {
  return useQuery({
    queryKey: challengeKeys.coach(),
    queryFn: () => api<ChallengeListResponse>("/coach/challenges"),
  });
}

export function useCoachChallenge(id: string) {
  return useQuery({
    queryKey: challengeKeys.coachDetail(id),
    queryFn: () => api<ChallengeDetail>(`/coach/challenges/${path(id)}`),
  });
}

export function useAthleteChallenges(athleteId: string) {
  return useQuery({
    queryKey: challengeKeys.athlete(athleteId),
    queryFn: () => api<ChallengeListResponse>(`/athletes/${path(athleteId)}/challenges`),
  });
}

/** Nach jeder Änderung: Detail direkt setzen, Listen neu laden. */
function useCoachMutation<TVariables>(
  request: (variables: TVariables) => Promise<ChallengeDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (detail) => {
      queryClient.setQueryData(challengeKeys.coachDetail(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: challengeKeys.all });
    },
  });
}

export function useCreateChallenge() {
  return useCoachMutation((body: CreateCoachChallengeRequest) =>
    api<ChallengeDetail>("/coach/challenges", { method: "POST", body }),
  );
}

export function useUpdateChallenge(id: string) {
  return useCoachMutation((body: UpdateCoachChallengeRequest) =>
    api<ChallengeDetail>(`/coach/challenges/${path(id)}`, { method: "PATCH", body }),
  );
}

export function useEndChallenge(id: string) {
  return useCoachMutation(() =>
    api<ChallengeDetail>(`/coach/challenges/${path(id)}/end`, { method: "POST" }),
  );
}

export function useDeleteChallenge(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/coach/challenges/${path(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: challengeKeys.coachDetail(id) });
      void queryClient.invalidateQueries({ queryKey: challengeKeys.all });
    },
  });
}
