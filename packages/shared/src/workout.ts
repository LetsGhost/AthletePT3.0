import { z } from "zod";

import { isoWeekSchema } from "./calendar";
import { isoDateSchema, objectIdSchema, paginationQuerySchema } from "./common";
import { MAX_EXERCISE_SETS, planSetOutputSchema, planTypeSchema, setKindSchema } from "./plan";
import { newRecordSchema } from "./stats";

/** So lange nach dem Abschließen bzw. Absagen darf der Athlet ein Protokoll noch ändern. */
export const WORKOUT_EDIT_DAYS = 7;
/** So viele Tage zurück darf ein Training nachgetragen oder abgesagt werden. */
export const WORKOUT_BACKFILL_DAYS = 14;

export const workoutStatuses = ["in_progress", "completed", "skipped"] as const;
export const workoutStatusSchema = z.enum(workoutStatuses);
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;
export const workoutStatusLabels: Record<WorkoutStatus, string> = {
  in_progress: "Läuft",
  completed: "Erledigt",
  skipped: "Abgesagt",
};

const number = () => z.number({ error: "Bitte eine Zahl angeben" });

const nullableNumber = (schema: z.ZodNumber) =>
  schema.nullish().transform((value) => value ?? null);

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen`)
    .nullish()
    .transform((value) => value || null);

/** Tatsächlich geschaffter Satz. Leere Werte sind erlaubt, solange der Satz nicht erledigt ist. */
export const workoutSetInputSchema = z.object({
  weightKg: nullableNumber(number().min(0, "Nicht negativ").max(1000, "Höchstens 1000 kg")),
  reps: nullableNumber(
    number().int("Bitte eine ganze Zahl").min(0, "Nicht negativ").max(200, "Höchstens 200"),
  ),
  durationSeconds: nullableNumber(
    number()
      .int("Bitte in ganzen Sekunden")
      .min(0, "Nicht negativ")
      .max(3600, "Höchstens 3600 Sekunden"),
  ),
  done: z.boolean().default(false),
});

export const workoutExerciseInputSchema = z.object({
  id: objectIdSchema,
  skipped: z.boolean().default(false),
  notes: nullableText(500),
  sets: z
    .array(workoutSetInputSchema)
    .max(MAX_EXERCISE_SETS, `Höchstens ${MAX_EXERCISE_SETS} Sätze`),
});

export const workoutRatingSchema = number()
  .int("Bitte eine ganze Zahl")
  .min(1, "Mindestens 1")
  .max(10, "Höchstens 10");

/**
 * Zwischenspeichern, Abschließen und Korrigieren schicken immer das ganze Protokoll.
 * Übungen lassen sich nicht hinzufügen oder entfernen, nur auslassen. `revision` ist der zuletzt
 * geladene Stand (sonst 409 `workout_conflict`).
 */
export const updateWorkoutRequestSchema = z.object({
  revision: z.number().int().min(0),
  exercises: z.array(workoutExerciseInputSchema),
  rating: nullableNumber(workoutRatingSchema),
  notes: nullableText(2000),
});

/** Ohne `date` gilt heute. */
export const startWorkoutRequestSchema = z.object({
  dayId: objectIdSchema,
  date: isoDateSchema.optional(),
});

export const skipWorkoutRequestSchema = startWorkoutRequestSchema.extend({
  /** Grund für die Absage, für den Coach. */
  notes: nullableText(2000),
});

export const workoutSetSchema = z.object({
  kind: setKindSchema,
  weightKg: z.number().nullable(),
  reps: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  done: z.boolean(),
});

/** Zuletzt geschaffte Sätze einer Übung (aus dem letzten abgeschlossenen Protokoll). */
export const previousPerformanceSchema = z.object({
  date: z.string(),
  sets: z.array(workoutSetSchema),
});

export const workoutExerciseSchema = z.object({
  id: objectIdSchema,
  /** Übungseintrag im Plan, nach dem trainiert wurde. */
  planExerciseId: objectIdSchema,
  exerciseId: objectIdSchema,
  exerciseName: z.string(),
  restSeconds: z.number().nullable(),
  /** Hinweise des Coaches zu dieser Übung im Plan. */
  planNotes: z.string().nullable(),
  /** Vorgabe aus dem Plan beim Start. Satz i gehört zu `targets[i]`, zusätzliche Sätze haben keine. */
  targets: z.array(planSetOutputSchema),
  skipped: z.boolean(),
  notes: z.string().nullable(),
  sets: z.array(workoutSetSchema),
  previous: previousPerformanceSchema.nullable(),
});

export const workoutLogSchema = z.object({
  id: objectIdSchema,
  athleteId: objectIdSchema,
  planId: objectIdSchema,
  /** Planstand beim Start (siehe Planversionen). */
  planRevision: z.number().int(),
  dayId: objectIdSchema,
  dayName: z.string(),
  dayType: planTypeSchema,
  date: z.string(),
  status: workoutStatusSchema,
  exercises: z.array(workoutExerciseSchema),
  rating: z.number().int().nullable(),
  notes: z.string().nullable(),
  revision: z.number().int(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  /** Bis dahin darf der Athlet das Protokoll noch ändern, `null` solange es läuft. */
  editableUntil: z.string().nullable(),
  /** Der angemeldete Nutzer darf das Protokoll jetzt ändern. */
  editable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Antwort beim Abschließen: das Protokoll und neue Bestwerte darin. */
export const completeWorkoutResponseSchema = workoutLogSchema.extend({
  newRecords: z.array(newRecordSchema),
});

export const workoutLogSummarySchema = z.object({
  id: objectIdSchema,
  planId: objectIdSchema,
  dayId: objectIdSchema,
  dayName: z.string(),
  dayType: planTypeSchema,
  date: z.string(),
  status: workoutStatusSchema,
  rating: z.number().int().nullable(),
  notes: z.string().nullable(),
  exerciseCount: z.number().int(),
  doneSetCount: z.number().int(),
  completedAt: z.string().nullable(),
});

export const workoutLogListQuerySchema = paginationQuerySchema;

export const workoutLogListResponseSchema = z.object({
  items: z.array(workoutLogSummarySchema),
  total: z.number().int(),
});

export const weekQuerySchema = z.object({ week: isoWeekSchema.optional() });

/** Freitexte je Wochentag (Montag bis Sonntag), z. B. „Laufen“ oder „Fußball“. */
export const weeklyActivitiesSchema = z
  .array(nullableText(40))
  .length(7, "Genau 7 Einträge (Montag bis Sonntag)");

export const updateWeeklyActivitiesRequestSchema = z.object({
  activities: weeklyActivitiesSchema,
});

export const weeklyActivitiesResponseSchema = z.object({
  activities: z.array(z.string().nullable()),
});

export const weekDayStatuses = ["open", "in_progress", "completed", "skipped"] as const;
export const weekDayStatusSchema = z.enum(weekDayStatuses);
export type WeekDayStatus = z.infer<typeof weekDayStatusSchema>;
export const weekDayStatusLabels: Record<WeekDayStatus, string> = {
  open: "Offen",
  in_progress: "Läuft",
  completed: "Erledigt",
  skipped: "Abgesagt",
};

export const weekPlanDaySchema = z.object({
  dayId: objectIdSchema,
  name: z.string(),
  type: planTypeSchema,
  weekday: z.number().int().min(1).max(7).nullable(),
  /** Erledigt, sobald ein Protokoll abgeschlossen ist; sonst abgesagt, läuft oder offen. */
  status: weekDayStatusSchema,
  logs: z.array(workoutLogSummarySchema),
});

/** Woche aus aktivem Plan und Protokollen berechnet, nichts davon wird gespeichert. */
export const weekViewSchema = z.object({
  week: z.string(),
  /** Montag und Sonntag der Woche. */
  startDate: z.string(),
  endDate: z.string(),
  today: z.string(),
  plan: z.object({ id: objectIdSchema, name: z.string() }).nullable(),
  days: z.array(weekPlanDaySchema),
  /** Protokolle der Woche, die zu keinem Tag des aktiven Plans gehören (z. B. früherer Plan). */
  otherLogs: z.array(workoutLogSummarySchema),
  activities: z.array(z.string().nullable()),
  completedCount: z.number().int(),
  plannedCount: z.number().int(),
  /** Laufendes Training des Athleten, egal aus welcher Woche. Für Coaches immer `null`. */
  inProgress: workoutLogSummarySchema.nullable(),
});

export type WorkoutSetInput = z.input<typeof workoutSetInputSchema>;
export type WorkoutExerciseInput = z.input<typeof workoutExerciseInputSchema>;
export type UpdateWorkoutRequest = z.input<typeof updateWorkoutRequestSchema>;
export type StartWorkoutRequest = z.input<typeof startWorkoutRequestSchema>;
export type SkipWorkoutRequest = z.input<typeof skipWorkoutRequestSchema>;
export type WorkoutSet = z.infer<typeof workoutSetSchema>;
export type PreviousPerformance = z.infer<typeof previousPerformanceSchema>;
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;
export type WorkoutLog = z.infer<typeof workoutLogSchema>;
export type CompleteWorkoutResponse = z.infer<typeof completeWorkoutResponseSchema>;
export type WorkoutLogSummary = z.infer<typeof workoutLogSummarySchema>;
export type WorkoutLogListQuery = z.input<typeof workoutLogListQuerySchema>;
export type WorkoutLogListResponse = z.infer<typeof workoutLogListResponseSchema>;
export type WeekQuery = z.input<typeof weekQuerySchema>;
export type UpdateWeeklyActivitiesRequest = z.input<typeof updateWeeklyActivitiesRequestSchema>;
export type WeeklyActivitiesResponse = z.infer<typeof weeklyActivitiesResponseSchema>;
export type WeekPlanDay = z.infer<typeof weekPlanDaySchema>;
export type WeekView = z.infer<typeof weekViewSchema>;
