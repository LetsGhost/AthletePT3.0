import {
  STATS_SESSION_LIMIT,
  STATS_TOP_COUNT,
  primaryMetric,
  sessionMetrics,
  type ExerciseBest,
  type ExerciseChange,
  type ExerciseRecord,
  type ExerciseSession,
  type ExerciseStatsDetail,
  type ExerciseStatsListResponse,
  type ExerciseStatsSummary,
  type NewRecord,
  type RecordKind,
  type StatsMetric,
} from "@athletept/shared";
import { Types } from "mongoose";

import { NotFoundError } from "../../lib/errors";
import { getAthleteOfCoach } from "../athletes/athlete-access";
import { WorkoutLogModel, type StoredWorkoutLog } from "../workouts/workout-log.model";

/**
 * Übungsanalyse, berechnet aus abgeschlossenen Protokollen. Nichts davon wird gespeichert, damit
 * Korrekturen am Protokoll sofort überall stimmen. Zuordnung über die `exerciseId`.
 */
type LogForStats = Pick<StoredWorkoutLog, "_id" | "date" | "completedAt" | "exercises">;

interface ExerciseSessions {
  exerciseId: string;
  exerciseName: string;
  sessions: ExerciseSession[];
}

async function loadLogs(athleteId: string, exerciseId?: string) {
  return WorkoutLogModel.find(
    {
      athleteId,
      status: "completed",
      ...(exerciseId ? { "exercises.exerciseId": new Types.ObjectId(exerciseId) } : {}),
    },
    { date: 1, completedAt: 1, exercises: 1 },
  )
    .sort({ date: 1, completedAt: 1 })
    .lean<LogForStats[]>();
}

/** Einheiten je Übung, älteste zuerst. Kommt eine Übung in einem Training doppelt vor, zählt sie als eine Einheit. */
function groupSessions(logs: readonly LogForStats[]) {
  const byExercise = new Map<string, ExerciseSessions>();
  for (const log of logs) {
    const perLog = new Map<
      string,
      { name: string; sets: StoredWorkoutLog["exercises"][number]["sets"] }
    >();
    for (const exercise of log.exercises) {
      if (exercise.skipped) continue;
      const id = exercise.exerciseId.toString();
      const entry = perLog.get(id) ?? { name: exercise.exerciseName, sets: [] };
      entry.sets = [...entry.sets, ...exercise.sets];
      perLog.set(id, entry);
    }
    for (const [id, { name, sets }] of perLog) {
      const metrics = sessionMetrics(sets);
      if (metrics.setCount === 0) continue;
      const group = byExercise.get(id) ?? { exerciseId: id, exerciseName: name, sessions: [] };
      group.exerciseName = name;
      group.sessions.push({ date: log.date, logId: log._id.toString(), ...metrics });
      byExercise.set(id, group);
    }
  }
  return byExercise;
}

function bestOf(sessions: readonly ExerciseSession[], kind: RecordKind): ExerciseRecord | null {
  let best: ExerciseRecord | null = null;
  for (const session of sessions) {
    const value = session[kind];
    if (value !== null && (best === null || value > best.value)) {
      best = { value, date: session.date, logId: session.logId };
    }
  }
  return best;
}

function changeOf(
  sessions: readonly ExerciseSession[],
  metric: StatsMetric,
): ExerciseChange | null {
  const withValue = sessions.filter((s) => s[metric] !== null);
  if (withValue.length < 2) return null;
  const first = withValue[0]!;
  const from = first[metric]!;
  const to = withValue.at(-1)![metric]!;
  return {
    from,
    to,
    fromDate: first.date,
    percent: from > 0 ? Math.round(((to - from) / from) * 1000) / 10 : 0,
  };
}

function summarize(group: ExerciseSessions): ExerciseStatsSummary & { window: ExerciseSession[] } {
  const metric = primaryMetric(group.sessions);
  const window = group.sessions.slice(-STATS_SESSION_LIMIT);
  const best: ExerciseBest = {
    estimated1rm: bestOf(group.sessions, "estimated1rm"),
    topWeightKg: bestOf(group.sessions, "topWeightKg"),
    maxReps: bestOf(group.sessions, "maxReps"),
    maxDurationSeconds: bestOf(group.sessions, "maxDurationSeconds"),
  };
  return {
    exerciseId: group.exerciseId,
    exerciseName: group.exerciseName,
    metric,
    sessionCount: group.sessions.length,
    lastDate: group.sessions.at(-1)!.date,
    best,
    change: changeOf(window, metric),
    window,
  };
}

async function listStats(athleteId: string): Promise<ExerciseStatsListResponse> {
  const groups = groupSessions(await loadLogs(athleteId));
  const items = [...groups.values()].map((group) => {
    const { window: _window, ...summary } = summarize(group);
    return summary;
  });
  items.sort(
    (a, b) => b.lastDate.localeCompare(a.lastDate) || a.exerciseName.localeCompare(b.exerciseName),
  );
  const records = items
    .filter((x) => x.best.estimated1rm !== null)
    .sort((a, b) => b.best.estimated1rm!.value - a.best.estimated1rm!.value)
    .slice(0, STATS_TOP_COUNT);
  return { items, records };
}

async function exerciseStats(athleteId: string, exerciseId: string): Promise<ExerciseStatsDetail> {
  const group = groupSessions(await loadLogs(athleteId, exerciseId)).get(exerciseId);
  if (!group) throw new NotFoundError("Zu dieser Übung gibt es noch keine Trainings");
  const { window, ...summary } = summarize(group);
  return { ...summary, sessions: window };
}

export function listMyStats(athleteId: string) {
  return listStats(athleteId);
}

export function getMyExerciseStats(athleteId: string, exerciseId: string) {
  return exerciseStats(athleteId, exerciseId);
}

export async function listAthleteStats(coachId: string, athleteId: string) {
  await getAthleteOfCoach(coachId, athleteId);
  return listStats(athleteId);
}

export async function getAthleteExerciseStats(
  coachId: string,
  athleteId: string,
  exerciseId: string,
) {
  await getAthleteOfCoach(coachId, athleteId);
  return exerciseStats(athleteId, exerciseId);
}

/**
 * Bestwerte, die ein gerade abgeschlossenes Training verbessert hat. Verglichen wird mit allen
 * anderen abgeschlossenen Trainings; beim ersten Mal gibt es noch keinen Bestwert zu schlagen.
 * Übungen mit Gewicht: geschätztes Maximum und höchstes Gewicht, sonst Wiederholungen bzw. Dauer.
 */
export async function findNewRecords(
  athleteId: string,
  logId: Types.ObjectId,
): Promise<NewRecord[]> {
  const groups = groupSessions(await loadLogs(athleteId));
  const records: NewRecord[] = [];
  for (const group of groups.values()) {
    const current = group.sessions.find((s) => s.logId === logId.toString());
    const others = group.sessions.filter((s) => s.logId !== logId.toString());
    if (!current || others.length === 0) continue;
    const metric = primaryMetric(group.sessions);
    const kinds: RecordKind[] =
      metric === "estimated1rm" ? ["estimated1rm", "topWeightKg"] : [metric];
    for (const kind of kinds) {
      const value = current[kind];
      const previous = bestOf(others, kind)?.value ?? null;
      if (value !== null && previous !== null && value > previous) {
        records.push({
          exerciseId: group.exerciseId,
          exerciseName: group.exerciseName,
          kind,
          value,
          previous,
        });
      }
    }
  }
  return records;
}
