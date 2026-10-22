import { z } from "zod";

import { writeSourceSchema } from "./api-key";
import { objectIdSchema } from "./common";
import {
  exerciseSchema,
  muscleGroupInfo,
  type ExerciseCategory,
  type MuscleGroup,
} from "./exercise";

/** Automatisch erkannter Schwerpunkt eines Trainingstags bzw. Plans. */
export const planTypes = ["LEGS", "UPPER", "LOWER", "FULLBODY"] as const;
export const planTypeSchema = z.enum(planTypes);
export type PlanType = z.infer<typeof planTypeSchema>;

export const planTypeLabels: Record<PlanType, string> = {
  LEGS: "Beine",
  UPPER: "Oberkörper",
  LOWER: "Unterkörper",
  FULLBODY: "Ganzkörper",
};

/**
 * Ab diesen Anteilen gilt ein Tag bzw. Plan als Beine, Unter- oder Oberkörper. `fullBody`: Machen
 * Ober- und Unterkörper jeweils mindestens diesen Anteil an Ober- plus Unterkörper aus (Rumpf
 * herausgerechnet), ist es Ganzkörper.
 */
export const planTypeThresholds = { legs: 0.75, lower: 0.5, upper: 0.5, fullBody: 0.25 } as const;

/** Cardio und Mobility sagen nichts über den Schwerpunkt aus und zählen nicht mit. */
const ignoredCategories: readonly ExerciseCategory[] = ["cardio", "mobility"];

export interface PlanTypeInput {
  category: ExerciseCategory;
  primaryMuscles: readonly MuscleGroup[];
}

/**
 * Erkennt den Schwerpunkt aus den Körperregionen der primären Muskelgruppen. Jede Übung zählt
 * einmal, ihr Gewicht verteilt sich anteilig auf ihre primären Muskelgruppen (Kreuzheben mit
 * Beinbeuger, Gesäß und unterem Rücken: ⅔ Unterkörper, ⅓ Rumpf). Rumpf zählt nur zur Gesamtmenge.
 *
 * Reihenfolge: Beine, dann Ganzkörper (Ober- und Unterkörper je ≥ 25 % ohne Rumpf), dann Unter-
 * und Oberkörper.
 */
export function detectPlanType(exercises: readonly PlanTypeInput[]): PlanType {
  let total = 0;
  let upper = 0;
  let lower = 0;
  for (const exercise of exercises) {
    if (ignoredCategories.includes(exercise.category) || exercise.primaryMuscles.length === 0) {
      continue;
    }
    total += 1;
    const share = 1 / exercise.primaryMuscles.length;
    for (const muscle of exercise.primaryMuscles) {
      const region = muscleGroupInfo[muscle].region;
      if (region === "upper") upper += share;
      if (region === "lower") lower += share;
    }
  }

  if (total === 0) return "FULLBODY";
  // Toleranz gegen Rundungsfehler bei Dritteln.
  const epsilon = 1e-9;
  if (lower / total + epsilon >= planTypeThresholds.legs) return "LEGS";
  const limbs = upper + lower;
  if (
    limbs > 0 &&
    upper / limbs + epsilon >= planTypeThresholds.fullBody &&
    lower / limbs + epsilon >= planTypeThresholds.fullBody
  ) {
    return "FULLBODY";
  }
  if (lower / total + epsilon >= planTypeThresholds.lower) return "LOWER";
  if (upper / total + epsilon >= planTypeThresholds.upper) return "UPPER";
  return "FULLBODY";
}

export const MAX_PLAN_DAYS = 7;
export const MAX_DAY_EXERCISES = 20;
export const MAX_EXERCISE_SETS = 10;
export const MAX_WARMUP_ITEMS = 10;

export const setKinds = ["warmup", "working"] as const;
export const setKindSchema = z.enum(setKinds);
export type SetKind = z.infer<typeof setKindSchema>;
export const setKindLabels: Record<SetKind, string> = {
  warmup: "Aufwärmsatz",
  working: "Arbeitssatz",
};

/** Wochentag nach ISO 8601: 1 = Montag … 7 = Sonntag. */
export const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof weekdays)[number];
export const weekdayLabels: Record<Weekday, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
  7: "Sonntag",
};

const number = () => z.number({ error: "Bitte eine Zahl angeben" });

/** Fehlend oder `null` wird zu `null`. */
const nullableNumber = (schema: z.ZodNumber) =>
  schema.nullish().transform((value) => value ?? null);

/** Leerer Text wird zu `null`. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen`)
    .nullish()
    .transform((value) => value || null);

const reps = () =>
  nullableNumber(
    number().int("Bitte eine ganze Zahl").min(1, "Mindestens 1").max(100, "Höchstens 100"),
  );

/**
 * Vorgabe für einen Satz: Wiederholungen (fest oder als Bereich) oder eine Dauer, dazu optional
 * Gewicht und RIR (Wiederholungen im Tank). Ohne Gewicht wählt der Athlet selbst.
 */
export const planSetSchema = z
  .object({
    kind: setKindSchema,
    repsMin: reps(),
    repsMax: reps(),
    durationSeconds: nullableNumber(
      number()
        .int("Bitte in ganzen Sekunden")
        .min(1, "Mindestens 1 Sekunde")
        .max(3600, "Höchstens 3600 Sekunden"),
    ),
    weightKg: nullableNumber(number().min(0, "Nicht negativ").max(1000, "Höchstens 1000 kg")),
    rir: nullableNumber(
      number().int("Bitte eine ganze Zahl").min(0, "Mindestens 0").max(10, "Höchstens 10"),
    ),
  })
  .superRefine((set, ctx) => {
    const hasReps = set.repsMin !== null || set.repsMax !== null;
    if (hasReps && set.durationSeconds !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: "Entweder Wiederholungen oder Dauer angeben",
      });
    } else if (!hasReps && set.durationSeconds === null) {
      ctx.addIssue({
        code: "custom",
        path: ["repsMin"],
        message: "Wiederholungen oder Dauer angeben",
      });
    } else if (hasReps && set.repsMin === null) {
      ctx.addIssue({ code: "custom", path: ["repsMin"], message: "Wiederholungen angeben" });
    } else if (set.repsMin !== null && set.repsMax !== null && set.repsMax < set.repsMin) {
      ctx.addIssue({
        code: "custom",
        path: ["repsMax"],
        message: "Darf nicht kleiner als das Minimum sein",
      });
    }
  })
  // Fester Wert: repsMax = repsMin, damit es nur eine Schreibweise gibt.
  .transform((set) =>
    set.repsMin !== null && set.repsMax === null ? { ...set, repsMax: set.repsMin } : set,
  );

export const planExerciseInputSchema = z.object({
  /** Fehlt bei neuen Einträgen. Bestehende behalten ihre ID (Protokolle verweisen darauf). */
  id: objectIdSchema.optional(),
  exerciseId: objectIdSchema,
  restSeconds: nullableNumber(
    number()
      .int("Bitte in ganzen Sekunden")
      .min(0, "Nicht negativ")
      .max(900, "Höchstens 900 Sekunden"),
  ),
  /** Ausführung, Tempo oder sonstige Hinweise zu dieser Übung im Plan. */
  notes: nullableText(500),
  sets: z
    .array(planSetSchema)
    .min(1, "Mindestens einen Satz angeben")
    .max(MAX_EXERCISE_SETS, `Höchstens ${MAX_EXERCISE_SETS} Sätze`),
});

/** Warm-up-Eintrag: eine Übung aus dem Katalog oder ein freier Text wie „5 min locker radeln“. */
export const warmupItemInputSchema = z
  .object({
    id: objectIdSchema.optional(),
    exerciseId: objectIdSchema.nullish().transform((value) => value ?? null),
    /** Bei Katalog-Übungen setzt der Server den Namen. */
    name: z.string().trim().max(80, "Höchstens 80 Zeichen").default(""),
    details: nullableText(300),
  })
  .refine((item) => item.exerciseId !== null || item.name.length >= 2, {
    path: ["name"],
    message: "Mindestens 2 Zeichen",
  });

export const planDayInputSchema = z.object({
  id: objectIdSchema.optional(),
  name: z.string().trim().min(1, "Bitte einen Namen angeben").max(40, "Höchstens 40 Zeichen"),
  weekday: z
    .number()
    .int()
    .min(1, "Ungültiger Wochentag")
    .max(7, "Ungültiger Wochentag")
    .nullish()
    .transform((value) => (value ?? null) as Weekday | null),
  warmup: z
    .array(warmupItemInputSchema)
    .max(MAX_WARMUP_ITEMS, `Höchstens ${MAX_WARMUP_ITEMS} Warm-up-Einträge`)
    .default([]),
  exercises: z
    .array(planExerciseInputSchema)
    .max(MAX_DAY_EXERCISES, `Höchstens ${MAX_DAY_EXERCISES} Übungen pro Tag`)
    .default([]),
});

/**
 * Inhalt eines Plans bzw. einer Vorlage. Entwürfe dürfen unvollständig sein; aktiv wird ein Plan
 * erst mit mindestens einem Tag und mindestens einer Übung pro Tag.
 */
export const planContentSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80, "Höchstens 80 Zeichen"),
  notes: nullableText(2000),
  days: z
    .array(planDayInputSchema)
    .max(MAX_PLAN_DAYS, `Höchstens ${MAX_PLAN_DAYS} Trainingstage`)
    .default([]),
});

export const createPlanRequestSchema = planContentSchema;

/** Ersetzt den Inhalt. `revision` ist der zuletzt geladene Stand (sonst 409 `plan_conflict`). */
export const updatePlanRequestSchema = planContentSchema.extend({
  revision: z.number().int().min(0),
});

export const planStatuses = ["draft", "active", "archived"] as const;
export const planStatusSchema = z.enum(planStatuses);
export type PlanStatus = z.infer<typeof planStatusSchema>;
export const planStatusLabels: Record<PlanStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  archived: "Archiviert",
};

export const planSetOutputSchema = z.object({
  kind: setKindSchema,
  repsMin: z.number().nullable(),
  repsMax: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  weightKg: z.number().nullable(),
  rir: z.number().nullable(),
});

export const planExerciseSchema = z.object({
  id: objectIdSchema,
  exerciseId: objectIdSchema,
  /** Name beim letzten Speichern. Bleibt lesbar, auch wenn die Übung archiviert wird. */
  exerciseName: z.string(),
  restSeconds: z.number().nullable(),
  notes: z.string().nullable(),
  sets: z.array(planSetOutputSchema),
});

export const warmupItemSchema = z.object({
  id: objectIdSchema,
  exerciseId: objectIdSchema.nullable(),
  name: z.string(),
  details: z.string().nullable(),
});

export const planDaySchema = z.object({
  id: objectIdSchema,
  name: z.string(),
  weekday: z.number().int().min(1).max(7).nullable(),
  type: planTypeSchema,
  warmup: z.array(warmupItemSchema),
  exercises: z.array(planExerciseSchema),
});

/**
 * Details zu allen im Plan verwendeten Übungen, auch archivierten und eigenen Übungen eines
 * früheren Coaches. `selectable`: Der anfragende Coach kann die Übung (neu) einplanen.
 */
export const planExerciseInfoSchema = exerciseSchema
  .pick({
    id: true,
    name: true,
    category: true,
    equipment: true,
    primaryMuscles: true,
    secondaryMuscles: true,
    description: true,
    executionNotes: true,
    videoUrl: true,
    archived: true,
  })
  .extend({ selectable: z.boolean() });

const planContentOutput = {
  name: z.string(),
  notes: z.string().nullable(),
  type: planTypeSchema,
  /** Steigt mit jeder Änderung. Beim Speichern mitschicken. */
  revision: z.number().int(),
  days: z.array(planDaySchema),
  exercises: z.array(planExerciseInfoSchema),
};

/** Wer den Plan angelegt hat: der Coach oder der Athlet selbst (Berechtigung `ownPlan`). */
export const planCreators = ["coach", "athlete"] as const;
export const planCreatorSchema = z.enum(planCreators);
export type PlanCreator = z.infer<typeof planCreatorSchema>;

export const planSchema = z.object({
  id: objectIdSchema,
  athleteId: objectIdSchema,
  status: planStatusSchema,
  createdBy: planCreatorSchema,
  ...planContentOutput,
  lastWriteVia: writeSourceSchema,
  activatedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const planSummarySchema = z.object({
  id: objectIdSchema,
  name: z.string(),
  status: planStatusSchema,
  type: planTypeSchema,
  createdBy: planCreatorSchema,
  dayCount: z.number().int(),
  lastWriteVia: writeSourceSchema,
  activatedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const planListResponseSchema = z.object({ items: z.array(planSummarySchema) });

/** Früherer Stand eines aktiven Plans, gesichert vor jeder Änderung. */
export const planVersionSummarySchema = z.object({
  revision: z.number().int(),
  name: z.string(),
  dayCount: z.number().int(),
  /** Bis zu diesem Zeitpunkt galt der Stand. */
  replacedAt: z.string(),
});

export const planVersionSchema = z.object({
  planId: objectIdSchema,
  ...planContentOutput,
  replacedAt: z.string(),
});

export const planVersionListResponseSchema = z.object({
  items: z.array(planVersionSummarySchema),
});

/** Aktiver Plan des angemeldeten Athleten, `null`, solange der Coach keinen freigegeben hat. */
export const myPlanResponseSchema = z.object({ plan: planSchema.nullable() });

export const planTemplateSchema = z.object({
  id: objectIdSchema,
  ...planContentOutput,
  lastWriteVia: writeSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const planTemplateSummarySchema = z.object({
  id: objectIdSchema,
  name: z.string(),
  type: planTypeSchema,
  dayCount: z.number().int(),
  updatedAt: z.string(),
});

export const planTemplateListResponseSchema = z.object({
  items: z.array(planTemplateSummarySchema),
});

export type PlanSet = z.infer<typeof planSetOutputSchema>;
export type PlanSetInput = z.input<typeof planSetSchema>;
export type PlanExercise = z.infer<typeof planExerciseSchema>;
export type WarmupItem = z.infer<typeof warmupItemSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
export type PlanExerciseInfo = z.infer<typeof planExerciseInfoSchema>;
export type PlanContent = z.input<typeof planContentSchema>;
export type CreatePlanRequest = z.input<typeof createPlanRequestSchema>;
export type UpdatePlanRequest = z.input<typeof updatePlanRequestSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanSummary = z.infer<typeof planSummarySchema>;
export type PlanListResponse = z.infer<typeof planListResponseSchema>;
export type PlanVersionSummary = z.infer<typeof planVersionSummarySchema>;
export type PlanVersion = z.infer<typeof planVersionSchema>;
export type PlanVersionListResponse = z.infer<typeof planVersionListResponseSchema>;
export type MyPlanResponse = z.infer<typeof myPlanResponseSchema>;
export type PlanTemplate = z.infer<typeof planTemplateSchema>;
export type PlanTemplateSummary = z.infer<typeof planTemplateSummarySchema>;
export type PlanTemplateListResponse = z.infer<typeof planTemplateListResponseSchema>;
