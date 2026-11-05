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
  myExercise: (exerciseId: string, excludeDeviating: boolean) =>
    [...statsKeys.mine(), exerciseId, excludeDeviating] as const,
  myActivity: (month: string | null) => ["workouts", "activity", "mine", month] as const,
  athlete: (athleteId: string) => ["workouts", "athlete", athleteId, "stats"] as const,
  athleteExercise: (athleteId: string, exerciseId: string, excludeDeviating: boolean) =>
    [...statsKeys.athlete(athleteId), exerciseId, excludeDeviating] as const,
  athleteActivity: (athleteId: string, month: string | null) =>
    ["workouts", "athlete", athleteId, "activity", month] as const,
};

const monthQuery = (month: string | null) => (month ? `?month=${month}` : "");
const deviatingQuery = (excludeDeviating: boolean) =>
  excludeDeviating ? "?excludeDeviating=true" : "";

export function useMyStats() {
  return useQuery({
    queryKey: statsKeys.mine(),
    queryFn: () => api<ExerciseStatsListResponse>("/me/exercise-stats"),
  });
}

/** `excludeDeviating`: Bestwerte und Veränderung ohne abweichende Trainings. */
export function useMyExerciseStats(exerciseId: string, excludeDeviating = false) {
  return useQuery({
    queryKey: statsKeys.myExercise(exerciseId, excludeDeviating),
    queryFn: () =>
      api<ExerciseStatsDetail>(
        `/me/exercise-stats/${encodeURIComponent(exerciseId)}${deviatingQuery(excludeDeviating)}`,
      ),
    placeholderData: keepPreviousData,
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
    queryFn: () =>
      api<ExerciseStatsListResponse>(`/athletes/${encodeURIComponent(athleteId)}/exercise-stats`),
  });
}

export function useAthleteExerciseStats(
  athleteId: string,
  exerciseId: string,
  excludeDeviating = false,
) {
  return useQuery({
    queryKey: statsKeys.athleteExercise(athleteId, exerciseId, excludeDeviating),
    queryFn: () =>
      api<ExerciseStatsDetail>(
        `/athletes/${encodeURIComponent(athleteId)}/exercise-stats/${encodeURIComponent(exerciseId)}${deviatingQuery(excludeDeviating)}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAthleteActivity(athleteId: string, month: string | null) {
  return useQuery({
    queryKey: statsKeys.athleteActivity(athleteId, month),
    queryFn: () =>
      api<ActivityResponse>(
        `/athletes/${encodeURIComponent(athleteId)}/activity${monthQuery(month)}`,
      ),
    placeholderData: keepPreviousData,
  });
}
