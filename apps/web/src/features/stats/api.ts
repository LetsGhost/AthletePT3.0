import type { ExerciseStatsDetail, ExerciseStatsListResponse } from "@athletept/shared";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

/** Unter `workouts`, damit neue Protokolle die Analyse automatisch neu laden. */
export const statsKeys = {
  mine: () => ["workouts", "stats", "mine"] as const,
  myExercise: (exerciseId: string) => [...statsKeys.mine(), exerciseId] as const,
  athlete: (athleteId: string) => ["workouts", "athlete", athleteId, "stats"] as const,
  athleteExercise: (athleteId: string, exerciseId: string) =>
    [...statsKeys.athlete(athleteId), exerciseId] as const,
};

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
