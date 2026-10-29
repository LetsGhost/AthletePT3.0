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
import { logger } from "../../lib/logger/logger";
import { getAthleteOfCoach } from "../athletes/athlete-access";
import {
  WorkoutLogModel,
  type StoredExerciseStats,
  type StoredWorkoutExercise,
  type StoredWorkoutLog,
} from "../workouts/workout-log.model";

/**
 * Übungsanalyse, berechnet aus abgeschlossenen Protokollen. Zuordnung über die `exerciseId`.
 *
 * Die Kennzahlen je Übung und Training stehen am Protokoll selbst (`stats`) und werden bei jedem
 * Speichern neu berechnet. So stimmen Korrekturen sofort überall, und die Analyse muss nur diese
 * kleinen Einträge laden statt aller Sätze. Alles darüber (Bestwerte, Verlauf) wird beim Abruf
 * berechnet.
 */

/**
 * Bei jeder Änderung an der Berechnung der Kennzahlen (`computeWorkoutStats`, `sessionMetrics`)
 * hochsetzen. Beim Start der API werden dann alle Protokolle neu berechnet.
 */
export const WORKOUT_STATS_VERSION = 2;

/**
 * Kennzahlen je Übung eines Trainings. Ausgelassene Übungen und solche ohne erledigten Arbeitssatz
 * fehlen, ebenso spontane Übungen ohne Katalogeintrag. Kommt eine Übung in einem Training doppelt
 * vor, zählt sie als eine Einheit (abweichend, wenn einer der Einträge abweichend ist).
 */
export function computeWorkoutStats(
  exercises: readonly Pick<
    StoredWorkoutExercise,
    "exerciseId" | "exerciseName" | "skipped" | "deviating" | "notes" | "sets"
  >[],
): StoredExerciseStats[] {
  const perExercise = new Map<
    string,
    {
      exerciseId: Types.ObjectId;
      name: string;
      deviating: boolean;
      notes: string | null;
      sets: StoredWorkoutExercise["sets"];
    }
  >();
  for (const exercise of exercises) {
    const { exerciseId } = exercise;
    if (exercise.skipped || !exerciseId) continue;
    const id = exerciseId.toString();
    const entry = perExercise.get(id) ?? {
      exerciseId,
      name: exercise.exerciseName,
      deviating: false,
      notes: null,
      sets: [],
    };
    entry.sets = [...entry.sets, ...exercise.sets];
    entry.deviating ||= Boolean(exercise.deviating);
    entry.notes ??= exercise.notes ?? null;
    perExercise.set(id, entry);
  }
  const stats: StoredExerciseStats[] = [];
  for (const { exerciseId, name, deviating, notes, sets } of perExercise.values()) {
    const metrics = sessionMetrics(sets);
    if (metrics.setCount > 0) {
      stats.push({ exerciseId, exerciseName: name, ...metrics, deviating, notes });
    }
  }
  return stats;
}

/**
 * Berechnet `stats` für alle abgeschlossenen Protokolle, die noch keine oder veraltete Kennzahlen
 * haben (Bestandsdaten, geänderte Berechnung). Idempotent, läuft beim Start der API.
 */
export async function backfillWorkoutStats() {
  const cursor = WorkoutLogModel.find(
    { status: "completed", statsVersion: { $ne: WORKOUT_STATS_VERSION } },
    { exercises: 1 },
  )
    .lean<Pick<StoredWorkoutLog, "_id" | "exercises">[]>()
    .cursor();
  let batch: Parameters<typeof WorkoutLogModel.bulkWrite>[0] = [];
  let updated = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    await WorkoutLogModel.bulkWrite(batch, { ordered: false });
    updated += batch.length;
    batch = [];
  };
  for await (const log of cursor) {
    batch.push({
      updateOne: {
        filter: { _id: log._id },
        update: {
          $set: { stats: computeWorkoutStats(log.exercises), statsVersion: WORKOUT_STATS_VERSION },
        },
      },
    });
    if (batch.length >= 500) await flush();
  }
  await flush();
  if (updated > 0) logger.info(`Kennzahlen für ${updated} Trainings neu berechnet`);
}

type LogForStats = Pick<StoredWorkoutLog, "_id" | "date" | "stats">;

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
    { date: 1, stats: 1 },
  )
    .sort({ date: 1, completedAt: 1 })
    .lean<LogForStats[]>();
}

/** Einheiten je Übung, älteste zuerst. */
function groupSessions(logs: readonly LogForStats[]) {
  const byExercise = new Map<string, ExerciseSessions>();
  for (const log of logs) {
    for (const { exerciseId, exerciseName, deviating, notes, ...metrics } of log.stats) {
      const id = exerciseId.toString();
      const group = byExercise.get(id) ?? { exerciseId: id, exerciseName, sessions: [] };
      group.exerciseName = exerciseName;
      group.sessions.push({
        date: log.date,
        logId: log._id.toString(),
        ...metrics,
        deviating: Boolean(deviating),
        notes: notes ?? null,
      });
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
      best = { value, date: session.date, logId: session.logId, deviating: session.deviating };
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

/** Mit `excludeDeviating` zählen abweichende Einheiten nicht in Bestwerte und Veränderung. */
function summarize(
  group: ExerciseSessions,
  excludeDeviating = false,
): ExerciseStatsSummary & { window: ExerciseSession[] } {
  const metric = primaryMetric(group.sessions);
  const window = group.sessions.slice(-STATS_SESSION_LIMIT);
  const counts = (s: ExerciseSession) => !excludeDeviating || !s.deviating;
  const counted = group.sessions.filter(counts);
  const best: ExerciseBest = {
    estimated1rm: bestOf(counted, "estimated1rm"),
    topWeightKg: bestOf(counted, "topWeightKg"),
    maxReps: bestOf(counted, "maxReps"),
    maxDurationSeconds: bestOf(counted, "maxDurationSeconds"),
  };
  return {
    exerciseId: group.exerciseId,
    exerciseName: group.exerciseName,
    metric,
    sessionCount: group.sessions.length,
    lastDate: group.sessions.at(-1)!.date,
    best,
    change: changeOf(window.filter(counts), metric),
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

async function exerciseStats(
  athleteId: string,
  exerciseId: string,
  excludeDeviating: boolean,
): Promise<ExerciseStatsDetail> {
  const group = groupSessions(await loadLogs(athleteId, exerciseId)).get(exerciseId);
  if (!group) throw new NotFoundError("Zu dieser Übung gibt es noch keine Trainings");
  const { window, ...summary } = summarize(group, excludeDeviating);
  return { ...summary, sessions: window };
}

export function listMyStats(athleteId: string) {
  return listStats(athleteId);
}

export function getMyExerciseStats(
  athleteId: string,
  exerciseId: string,
  excludeDeviating = false,
) {
  return exerciseStats(athleteId, exerciseId, excludeDeviating);
}

export async function listAthleteStats(coachId: string, athleteId: string) {
  await getAthleteOfCoach(coachId, athleteId);
  return listStats(athleteId);
}

export async function getAthleteExerciseStats(
  coachId: string,
  athleteId: string,
  exerciseId: string,
  excludeDeviating = false,
) {
  await getAthleteOfCoach(coachId, athleteId);
  return exerciseStats(athleteId, exerciseId, excludeDeviating);
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
