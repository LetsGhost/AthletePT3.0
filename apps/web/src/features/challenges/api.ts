import type {
  BadgeListResponse,
  ChallengeDetail,
  ChallengeSettings,
  NicknameCheckResponse,
  UpdateChallengeSettingsRequest,
  ChallengeListResponse,
  CreateCoachChallengeRequest,
  CreateDuelRequest,
  TeamDuelListResponse,
  UpdateCoachChallengeRequest,
} from "@athletept/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationKeys } from "@/features/notifications/api";
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

export function useTeamDuels() {
  return useQuery({
    queryKey: [...challengeKeys.coach(), "duels"],
    queryFn: () => api<TeamDuelListResponse>("/coach/challenges/duels"),
  });
}

/** Nach jeder Duell-Aktion: Detail setzen, Listen und Benachrichtigungen neu laden. */
function useDuelMutation<TVariables>(request: (variables: TVariables) => Promise<ChallengeDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (detail) => {
      queryClient.setQueryData(challengeKeys.myDetail(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: challengeKeys.mine(), exact: true });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useCreateDuel() {
  return useDuelMutation((body: CreateDuelRequest) =>
    api<ChallengeDetail>("/me/duels", { method: "POST", body }),
  );
}

export function useAcceptDuel(id: string) {
  return useDuelMutation(() =>
    api<ChallengeDetail>(`/me/duels/${path(id)}/accept`, { method: "POST" }),
  );
}

export function useGiveUpDuel(id: string) {
  return useDuelMutation(() =>
    api<ChallengeDetail>(`/me/duels/${path(id)}/give-up`, { method: "POST" }),
  );
}

export function useRematchDuel(id: string) {
  return useDuelMutation(() =>
    api<ChallengeDetail>(`/me/duels/${path(id)}/rematch`, { method: "POST" }),
  );
}

export function useDeclineDuel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/me/duels/${path(id)}/decline`, { method: "POST" }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: challengeKeys.myDetail(id) });
      void queryClient.invalidateQueries({ queryKey: challengeKeys.mine(), exact: true });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDiscoverChallenges() {
  return useQuery({
    queryKey: [...challengeKeys.mine(), "discover"],
    queryFn: () => api<ChallengeListResponse>("/me/challenges/discover"),
  });
}

/** Beitreten und Verlassen von System-Challenges. */
function useMembership(id: string, action: "join" | "leave") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<ChallengeDetail>(`/me/challenges/${path(id)}/${action}`, { method: "POST" }),
    onSuccess: (detail) => {
      queryClient.setQueryData(challengeKeys.myDetail(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: challengeKeys.mine() });
      void queryClient.invalidateQueries({ queryKey: badgeKeys.mine() });
    },
  });
}

export const useJoinChallenge = (id: string) => useMembership(id, "join");
export const useLeaveChallenge = (id: string) => useMembership(id, "leave");

export const settingsKeys = {
  mine: () => ["challenge-settings"] as const,
};

export const badgeKeys = {
  mine: () => [...challengeKeys.all, "badges"] as const,
};

export function useChallengeSettings({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: settingsKeys.mine(),
    queryFn: () => api<ChallengeSettings>("/me/challenge-settings"),
    enabled,
  });
}

export function useUpdateChallengeSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateChallengeSettingsRequest) =>
      api<ChallengeSettings>("/me/challenge-settings", { method: "PUT", body }),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKeys.mine(), settings);
      // Ranglisten zeigen den neuen Spitznamen.
      void queryClient.invalidateQueries({ queryKey: challengeKeys.all });
    },
  });
}

export function useNicknameCheck(nickname: string) {
  return useQuery({
    queryKey: [...settingsKeys.mine(), "check", nickname],
    queryFn: () =>
      api<NicknameCheckResponse>(
        `/me/challenge-settings/nickname-check?nickname=${encodeURIComponent(nickname)}`,
      ),
    enabled: nickname.length > 0,
  });
}

export function useMyBadges() {
  return useQuery({
    queryKey: badgeKeys.mine(),
    queryFn: () => api<BadgeListResponse>("/me/badges"),
  });
}
