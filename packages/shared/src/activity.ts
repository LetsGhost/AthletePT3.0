import { z } from "zod";

import { objectIdSchema } from "./common";

/**
 * Trainingsdauern außerhalb dieses Bereichs sind nicht aussagekräftig (nachgetragen in einer
 * Minute oder über Nacht offen gelassen) und zählen nicht zur Trainingszeit.
 */
export const MIN_WORKOUT_MINUTES = 1;
export const MAX_WORKOUT_MINUTES = 240;

/** Monat wie `2026-10`. */
export const isoMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Ungültiger Monat");

export const activityQuerySchema = z.object({ month: isoMonthSchema.optional() });

/**
 * - `fulfilled`: mindestens ein Training abgeschlossen
 * - `missed`: Woche vorbei, kein Training (bricht die Streak)
 * - `open`: laufende Woche, noch kein Training (bricht die Streak noch nicht)
 * - `paused`: kein aktiver Plan am Sonntag, oder kein Training und der Plan wurde erst im Laufe
 *   der Woche aktiviert (zählt nicht, bricht aber auch nicht)
 * - `upcoming`: Woche liegt in der Zukunft
 */
export const activityWeekStatuses = ["fulfilled", "missed", "open", "paused", "upcoming"] as const;
export const activityWeekStatusSchema = z.enum(activityWeekStatuses);
export type ActivityWeekStatus = z.infer<typeof activityWeekStatusSchema>;
export const activityWeekStatusLabels: Record<ActivityWeekStatus, string> = {
  fulfilled: "Trainiert",
  missed: "Kein Training",
  open: "Läuft noch",
  paused: "Kein Plan aktiv",
  upcoming: "Noch nicht begonnen",
};

export const activityWeekSchema = z.object({
  week: z.string(),
  /** Montag der Woche. */
  startDate: z.string(),
  status: activityWeekStatusSchema,
  completedCount: z.number().int(),
  /** Trainingstage des Plans, der am Wochenende aktiv war. `null` ohne Plan. */
  plannedCount: z.number().int().nullable(),
});

export const activityWorkoutSchema = z.object({
  id: objectIdSchema,
  dayName: z.string(),
  /** Vom Start bis zum Abschluss. `null`, wenn die Dauer nicht aussagekräftig ist. */
  durationMinutes: z.number().int().nullable(),
});

export const activityDaySchema = z.object({
  date: z.string(),
  workouts: z.array(activityWorkoutSchema),
});

export const activityResponseSchema = z.object({
  month: z.string(),
  today: z.string(),
  /** Aufeinanderfolgende Wochen mit mindestens einem Training bis heute, unabhängig vom Monat. */
  streakWeeks: z.number().int(),
  /** Alle ISO-Wochen, die den Monat berühren. */
  weeks: z.array(activityWeekSchema),
  /** Nur Tage des Monats mit mindestens einem abgeschlossenen Training. */
  days: z.array(activityDaySchema),
  workoutCount: z.number().int(),
  totalMinutes: z.number().int(),
  /** Durchschnitt über Trainings mit aussagekräftiger Dauer, `null` ohne solche. */
  averageMinutes: z.number().int().nullable(),
});

export type ActivityQuery = z.input<typeof activityQuerySchema>;
export type ActivityWeek = z.infer<typeof activityWeekSchema>;
export type ActivityWorkout = z.infer<typeof activityWorkoutSchema>;
export type ActivityDay = z.infer<typeof activityDaySchema>;
export type ActivityResponse = z.infer<typeof activityResponseSchema>;
