import type {
  CompleteWorkoutResponse,
  SkipWorkoutRequest,
  StartWorkoutRequest,
  UpdateWeeklyActivitiesRequest,
  UpdateWorkoutRequest,
  WeekView,
  WeeklyActivitiesResponse,
  WorkoutLog,
  WorkoutLogListResponse,
} from "@athletept/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const WORKOUT_PAGE_SIZE = 10;

export const workoutKeys = {
  all: ["workouts"] as const,
  myWeek: (week: string | null) => [...workoutKeys.all, "my-week", week] as const,
  myList: (page: number) => [...workoutKeys.all, "my-list", page] as const,
  mine: (id: string) => [...workoutKeys.all, "mine", id] as const,
  athlete: (athleteId: string) => [...workoutKeys.all, "athlete", athleteId] as const,
  athleteWeek: (athleteId: string, week: string | null) =>
    [...workoutKeys.athlete(athleteId), "week", week] as const,
  athleteList: (athleteId: string, page: number) =>
    [...workoutKeys.athlete(athleteId), "list", page] as const,
  athleteLog: (athleteId: string, id: string) =>
    [...workoutKeys.athlete(athleteId), "log", id] as const,
};

const weekQuery = (week: string | null) => (week ? `?week=${week}` : "");

/** Eigene Trainingswoche. `week: null` = aktuelle Woche. */
export function useMyWeek(week: string | null = null) {
  return useQuery({
    queryKey: workoutKeys.myWeek(week),
    queryFn: () => api<WeekView>(`/me/week${weekQuery(week)}`),
    placeholderData: keepPreviousData,
  });
}

export function useMyWorkouts(page: number) {
  return useQuery({
    queryKey: workoutKeys.myList(page),
    queryFn: () =>
      api<WorkoutLogListResponse>(`/me/workout-logs?page=${page}&pageSize=${WORKOUT_PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  });
}

export function useMyWorkout(id: string) {
  return useQuery({
    queryKey: workoutKeys.mine(id),
    queryFn: () => api<WorkoutLog>(`/me/workout-logs/${id}`),
    // Während des Trainings nicht im Hintergrund neu laden, das Formular ist die Quelle.
    refetchOnWindowFocus: false,
  });
}

/** Woche, Listen und Plan-Status neu laden; das Protokoll selbst direkt setzen. */
function useInvalidateMine() {
  const queryClient = useQueryClient();
  return (log?: WorkoutLog) => {
    if (log) queryClient.setQueryData(workoutKeys.mine(log.id), log);
    void queryClient.invalidateQueries({
      queryKey: workoutKeys.all,
      predicate: (query) => query.queryKey[1] !== "mine",
    });
  };
}

export function useStartWorkout() {
  const invalidate = useInvalidateMine();
  return useMutation({
    mutationFn: (body: StartWorkoutRequest) =>
      api<WorkoutLog>("/me/workout-logs", { method: "POST", body }),
    onSuccess: (log) => invalidate(log),
  });
}

export function useSkipWorkout() {
  const invalidate = useInvalidateMine();
  return useMutation({
    mutationFn: (body: SkipWorkoutRequest) =>
      api<WorkoutLog>("/me/workout-logs/skip", { method: "POST", body }),
    onSuccess: (log) => invalidate(log),
  });
}

/** Zwischenspeichern. Ohne Cache-Update, das übernimmt der Autosave. */
export function saveWorkout(id: string, body: UpdateWorkoutRequest) {
  return api<WorkoutLog>(`/me/workout-logs/${id}`, { method: "PUT", body });
}

export function useCompleteWorkout(id: string) {
  const invalidate = useInvalidateMine();
  return useMutation({
    mutationFn: (body: UpdateWorkoutRequest) =>
      api<CompleteWorkoutResponse>(`/me/workout-logs/${id}/complete`, { method: "POST", body }),
    onSuccess: (log) => invalidate(log),
  });
}

/** Laufendes Training verwerfen oder Absage zurücknehmen. */
export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateMine();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/me/workout-logs/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: workoutKeys.mine(id) });
      invalidate();
    },
  });
}

export function useAthleteWeek(athleteId: string, week: string | null) {
  return useQuery({
    queryKey: workoutKeys.athleteWeek(athleteId, week),
    queryFn: () => api<WeekView>(`/athletes/${athleteId}/week${weekQuery(week)}`),
    placeholderData: keepPreviousData,
  });
}

export function useAthleteWorkouts(athleteId: string, page: number) {
  return useQuery({
    queryKey: workoutKeys.athleteList(athleteId, page),
    queryFn: () =>
      api<WorkoutLogListResponse>(
        `/athletes/${athleteId}/workout-logs?page=${page}&pageSize=${WORKOUT_PAGE_SIZE}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAthleteWorkout(athleteId: string, id: string) {
  return useQuery({
    queryKey: workoutKeys.athleteLog(athleteId, id),
    queryFn: () => api<WorkoutLog>(`/athletes/${athleteId}/workout-logs/${id}`),
  });
}

export function useUpdateWeeklyActivities(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWeeklyActivitiesRequest) =>
      api<WeeklyActivitiesResponse>(`/athletes/${athleteId}/weekly-activities`, {
        method: "PUT",
        body,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...workoutKeys.athlete(athleteId), "week"] }),
  });
}
