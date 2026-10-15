import { z } from "zod";

import { objectIdSchema } from "./common";
import type { SetKind } from "./plan";

/** So viele Einheiten zeigt der Verlauf einer Übung. */
export const STATS_SESSION_LIMIT = 16;
/** So viele Übungen stehen in den Rekorden. */
export const STATS_TOP_COUNT = 4;
/** Über so vielen Wiederholungen wird das geschätzte Maximum zu ungenau. */
export const MAX_E1RM_REPS = 12;

/**
 * Hauptkennzahl einer Übung: geschätztes Maximum bei Übungen mit Gewicht, das höchste Gewicht,
 * wenn nur mit mehr als 12 Wdh. trainiert wird (z. B. Seitheben), sonst die meisten
 * Wiederholungen (z. B. Klimmzüge) bzw. die längste Dauer (z. B. Plank).
 */
export const statsMetrics = [
  "estimated1rm",
  "topWeightKg",
  "maxReps",
  "maxDurationSeconds",
] as const;
export const statsMetricSchema = z.enum(statsMetrics);
export type StatsMetric = z.infer<typeof statsMetricSchema>;

export const recordKinds = [
  "estimated1rm",
  "topWeightKg",
  "maxReps",
  "maxDurationSeconds",
] as const;
export const recordKindSchema = z.enum(recordKinds);
export type RecordKind = z.infer<typeof recordKindSchema>;
export const recordKindLabels: Record<RecordKind, string> = {
  estimated1rm: "Geschätztes Maximum",
  topWeightKg: "Höchstes Gewicht",
  maxReps: "Meiste Wiederholungen",
  maxDurationSeconds: "Längste Dauer",
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Geschätztes Maximalgewicht für eine Wiederholung nach Epley: Gewicht × (1 + Wdh. / 30).
 * Bei einer Wiederholung das Gewicht selbst. `null` ohne Gewicht oder bei mehr als 12 Wdh.
 */
export function estimateOneRepMax(weightKg: number | null, reps: number | null) {
  if (weightKg === null || weightKg <= 0 || reps === null || reps < 1 || reps > MAX_E1RM_REPS) {
    return null;
  }
  return reps === 1 ? weightKg : round1(weightKg * (1 + reps / 30));
}

export interface StatsSetInput {
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  done: boolean;
}

export interface SessionMetrics {
  topWeightKg: number | null;
  estimated1rm: number | null;
  volumeKg: number | null;
  maxReps: number | null;
  maxDurationSeconds: number | null;
  setCount: number;
}

const maxOf = (values: (number | null)[]) => {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? Math.max(...present) : null;
};

/** Kennzahlen einer Übung in einer Einheit. Zählt nur erledigte Arbeitssätze. */
export function sessionMetrics(sets: readonly StatsSetInput[]): SessionMetrics {
  const working = sets.filter((s) => s.done && s.kind === "working");
  const weighted = working.filter((s) => s.weightKg !== null && s.weightKg > 0);
  const volume = weighted.reduce((sum, s) => sum + (s.reps ?? 0) * s.weightKg!, 0);
  return {
    topWeightKg: maxOf(weighted.map((s) => s.weightKg)),
    estimated1rm: maxOf(working.map((s) => estimateOneRepMax(s.weightKg, s.reps))),
    volumeKg: volume > 0 ? round1(volume) : null,
    maxReps: maxOf(working.map((s) => s.reps)),
    maxDurationSeconds: maxOf(working.map((s) => s.durationSeconds)),
    setCount: working.length,
  };
}

/** Hauptkennzahl aus allen Einheiten einer Übung. */
export function primaryMetric(sessions: readonly SessionMetrics[]): StatsMetric {
  if (sessions.some((s) => s.estimated1rm !== null)) return "estimated1rm";
  if (sessions.some((s) => s.topWeightKg !== null)) return "topWeightKg";
  if (sessions.some((s) => s.maxReps !== null)) return "maxReps";
  return "maxDurationSeconds";
}

export const exerciseSessionSchema = z.object({
  date: z.string(),
  logId: objectIdSchema,
  topWeightKg: z.number().nullable(),
  estimated1rm: z.number().nullable(),
  volumeKg: z.number().nullable(),
  maxReps: z.number().nullable(),
  maxDurationSeconds: z.number().nullable(),
  setCount: z.number().int(),
});

export const exerciseRecordSchema = z.object({
  value: z.number(),
  date: z.string(),
  logId: objectIdSchema,
});

export const exerciseBestSchema = z.object({
  estimated1rm: exerciseRecordSchema.nullable(),
  topWeightKg: exerciseRecordSchema.nullable(),
  maxReps: exerciseRecordSchema.nullable(),
  maxDurationSeconds: exerciseRecordSchema.nullable(),
});

/** Veränderung der Hauptkennzahl von der ersten zur letzten Einheit im Verlauf. */
export const exerciseChangeSchema = z.object({
  from: z.number(),
  to: z.number(),
  fromDate: z.string(),
  /** Prozent, gerundet auf eine Nachkommastelle. */
  percent: z.number(),
});

export const exerciseStatsSummarySchema = z.object({
  exerciseId: objectIdSchema,
  exerciseName: z.string(),
  metric: statsMetricSchema,
  sessionCount: z.number().int(),
  lastDate: z.string(),
  best: exerciseBestSchema,
  change: exerciseChangeSchema.nullable(),
});

export const exerciseStatsListResponseSchema = z.object({
  /** Zuletzt trainierte zuerst. */
  items: z.array(exerciseStatsSummarySchema),
  /** Übungen mit dem höchsten geschätzten Maximum. */
  records: z.array(exerciseStatsSummarySchema),
});

export const exerciseStatsDetailSchema = exerciseStatsSummarySchema.extend({
  /** Letzte Einheiten, älteste zuerst. */
  sessions: z.array(exerciseSessionSchema),
});

/** Neuer Bestwert beim Abschließen eines Trainings. */
export const newRecordSchema = z.object({
  exerciseId: objectIdSchema,
  exerciseName: z.string(),
  kind: recordKindSchema,
  value: z.number(),
  previous: z.number(),
});

export type ExerciseSession = z.infer<typeof exerciseSessionSchema>;
export type ExerciseRecord = z.infer<typeof exerciseRecordSchema>;
export type ExerciseBest = z.infer<typeof exerciseBestSchema>;
export type ExerciseChange = z.infer<typeof exerciseChangeSchema>;
export type ExerciseStatsSummary = z.infer<typeof exerciseStatsSummarySchema>;
export type ExerciseStatsListResponse = z.infer<typeof exerciseStatsListResponseSchema>;
export type ExerciseStatsDetail = z.infer<typeof exerciseStatsDetailSchema>;
export type NewRecord = z.infer<typeof newRecordSchema>;
