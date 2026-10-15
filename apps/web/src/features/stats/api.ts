import type {
  ActivityResponse,
  ExerciseStatsDetail,
  ExerciseStatsListResponse,
} from "@athletept/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

/** Unter `workouts`, damit neue Protokolle die Analyse automatisch neu laden. */
export const statsKeys = {
  mine: () => ["workouts", "stats", "mine"] as const,
  myExercise: (exerciseId: string) => [...statsKeys.mine(), exerciseId] as const,
  myActivity: (month: string | null) => ["workouts", "activity", "mine", month] as const,
  athlete: (athleteId: string) => ["workouts", "athlete", athleteId, "stats"] as const,
  athleteExercise: (athleteId: string, exerciseId: string) =>
    [...statsKeys.athlete(athleteId), exerciseId] as const,
  athleteActivity: (athleteId: string, month: string | null) =>
    ["workouts", "athlete", athleteId, "activity", month] as const,
};

const monthQuery = (month: string | null) => (month ? `?month=${month}` : "");

export function useMyStats() {
  return useQuery({
    queryKey: statsKeys.mine(),
    queryFn: () => api<ExerciseStatsListResponse>("/me/exercise-stats"),
  });
}

export function useMyExerciseStats(exerciseId: string) {
  return useQuery({
    queryKey: statsKeys.myExercise(exerciseId),
    queryFn: () => api<ExerciseStatsDetail>(`/me/exercise-stats/${exerciseId}`),
  });
}

/** Trainingskalender mit Streak. `month: null` = aktueller Monat. */
export function useMyActivity(month: string | null) {
  return useQuery({
    queryKey: statsKeys.myActivity(month),
    queryFn: () => api<ActivityResponse>(`/me/activity${monthQuery(month)}`),
    placeholderData: keepPreviousData,
  });
}

export function useAthleteStats(athleteId: string) {
  return useQuery({
    queryKey: statsKeys.athlete(athleteId),
    queryFn: () => api<ExerciseStatsListResponse>(`/athletes/${athleteId}/exercise-stats`),
  });
}

export function useAthleteExerciseStats(athleteId: string, exerciseId: string) {
  return useQuery({
    queryKey: statsKeys.athleteExercise(athleteId, exerciseId),
    queryFn: () => api<ExerciseStatsDetail>(`/athletes/${athleteId}/exercise-stats/${exerciseId}`),
  });
}

export function useAthleteActivity(athleteId: string, month: string | null) {
  return useQuery({
    queryKey: statsKeys.athleteActivity(athleteId, month),
    queryFn: () => api<ActivityResponse>(`/athletes/${athleteId}/activity${monthQuery(month)}`),
    placeholderData: keepPreviousData,
  });
}
