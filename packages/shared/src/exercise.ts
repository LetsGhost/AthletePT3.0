import { z } from "zod";

import { objectIdSchema, paginationQuerySchema } from "./common";

/** Körperregion. Grundlage für die automatische Plan-Typ-Erkennung (Ober-/Unterkörper). */
export const bodyRegions = ["upper", "core", "lower"] as const;
export type BodyRegion = (typeof bodyRegions)[number];

export const bodyRegionLabels: Record<BodyRegion, string> = {
  upper: "Oberkörper",
  core: "Rumpf",
  lower: "Unterkörper",
};

/**
 * Feste Liste der Muskelgruppen. Schlüssel sind stabil (werden gespeichert), Bezeichnungen
 * dürfen sich ändern. Neue Gruppen nur ergänzen, nie umbenennen oder entfernen.
 */
export const muscleGroupInfo = {
  chest: { label: "Brust", region: "upper" },
  front_delts: { label: "Vordere Schulter", region: "upper" },
  side_delts: { label: "Seitliche Schulter", region: "upper" },
  rear_delts: { label: "Hintere Schulter", region: "upper" },
  lats: { label: "Latissimus", region: "upper" },
  upper_back: { label: "Oberer Rücken", region: "upper" },
  traps: { label: "Trapez / Nacken", region: "upper" },
  biceps: { label: "Bizeps", region: "upper" },
  triceps: { label: "Trizeps", region: "upper" },
  forearms: { label: "Unterarme", region: "upper" },
  abs: { label: "Bauch", region: "core" },
  obliques: { label: "Seitliche Bauchmuskeln", region: "core" },
  lower_back: { label: "Unterer Rücken", region: "core" },
  glutes: { label: "Gesäß", region: "lower" },
  quads: { label: "Quadrizeps", region: "lower" },
  hamstrings: { label: "Beinbeuger", region: "lower" },
  adductors: { label: "Adduktoren", region: "lower" },
  abductors: { label: "Abduktoren", region: "lower" },
  calves: { label: "Waden", region: "lower" },
} as const satisfies Record<string, { label: string; region: BodyRegion }>;

export type MuscleGroup = keyof typeof muscleGroupInfo;
export const muscleGroups = Object.keys(muscleGroupInfo) as [MuscleGroup, ...MuscleGroup[]];
export const muscleGroupSchema = z.enum(muscleGroups, "Unbekannte Muskelgruppe");

export const equipmentLabels = {
  barbell: "Langhantel",
  dumbbell: "Kurzhantel",
  machine: "Maschine",
  cable: "Kabelzug",
  bodyweight: "Körpergewicht",
  kettlebell: "Kettlebell",
  band: "Widerstandsband",
  other: "Sonstiges",
} as const;

export type Equipment = keyof typeof equipmentLabels;
export const equipmentTypes = Object.keys(equipmentLabels) as [Equipment, ...Equipment[]];
export const equipmentSchema = z.enum(equipmentTypes, "Bitte Equipment wählen");

export const exerciseCategoryLabels = {
  compound: "Grundübung",
  isolation: "Isolationsübung",
  cardio: "Cardio",
  mobility: "Mobility",
} as const;

export type ExerciseCategory = keyof typeof exerciseCategoryLabels;
export const exerciseCategories = Object.keys(exerciseCategoryLabels) as [
  ExerciseCategory,
  ...ExerciseCategory[],
];
export const exerciseCategorySchema = z.enum(exerciseCategories, "Bitte Kategorie wählen");

/**
 * Normalisierte Form eines Namens für Suche und Eindeutigkeit: klein, Umlaute ausgeschrieben,
 * Satz- und Leerzeichen vereinheitlicht. „Bankdrücken (LH)“ und „bankdruecken lh“ sind gleich.
 */
export function exerciseSearchKey(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const MAX_EXERCISE_ALIASES = 10;

const exerciseNameSchema = z
  .string()
  .trim()
  .min(2, "Mindestens 2 Zeichen")
  .max(80, "Höchstens 80 Zeichen")
  .refine(
    (value) => exerciseSearchKey(value).length > 0,
    "Der Name braucht Buchstaben oder Zahlen",
  );

/** Leerer Text wird zu `null`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen`)
    .transform((value) => value || null)
    .nullable();

// Ohne Defaults: zod 4 setzt Defaults auch in `.partial()`, ein PATCH würde sonst Felder leeren.
const exerciseFields = {
  name: exerciseNameSchema,
  /** Andere Bezeichnungen, z. B. „Bench Press“. Werden bei der Suche berücksichtigt. */
  aliases: z
    .array(z.string().trim().min(1).max(80, "Höchstens 80 Zeichen"))
    .max(MAX_EXERCISE_ALIASES, `Höchstens ${MAX_EXERCISE_ALIASES} Synonyme`),
  category: exerciseCategorySchema,
  equipment: equipmentSchema,
  primaryMuscles: z
    .array(muscleGroupSchema)
    .min(1, "Mindestens eine primäre Muskelgruppe wählen")
    .max(muscleGroups.length),
  secondaryMuscles: z.array(muscleGroupSchema).max(muscleGroups.length),
  description: optionalText(2000),
  executionNotes: optionalText(2000),
  videoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(value),
      "Bitte einen https-Link angeben",
    )
    .transform((value) => value || null)
    .nullable(),
};

/** Eine Muskelgruppe ist entweder primär oder sekundär, nicht beides. */
function musclesDisjoint(data: { primaryMuscles?: string[]; secondaryMuscles?: string[] }) {
  const primary = new Set(data.primaryMuscles ?? []);
  return !(data.secondaryMuscles ?? []).some((muscle) => primary.has(muscle));
}

const disjointIssue = {
  path: ["secondaryMuscles"],
  message: "Eine Muskelgruppe kann nicht zugleich primär und sekundär sein",
};

export const createExerciseRequestSchema = z
  .object({
    ...exerciseFields,
    aliases: exerciseFields.aliases.default([]),
    secondaryMuscles: exerciseFields.secondaryMuscles.default([]),
    description: exerciseFields.description.default(null),
    executionNotes: exerciseFields.executionNotes.default(null),
    videoUrl: exerciseFields.videoUrl.default(null),
  })
  .refine(musclesDisjoint, disjointIssue);

/** Teil-Update. Werden Muskelgruppen geändert, müssen primäre und sekundäre zusammen kommen. */
export const updateExerciseRequestSchema = z
  .object(exerciseFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Keine Änderungen angegeben")
  .refine(
    (data) => (data.primaryMuscles === undefined) === (data.secondaryMuscles === undefined),
    "Primäre und sekundäre Muskelgruppen nur gemeinsam ändern",
  )
  .refine(musclesDisjoint, disjointIssue);

export const exerciseScopes = ["global", "own"] as const;
export type ExerciseScope = (typeof exerciseScopes)[number];

export const exerciseSchema = z.object({
  id: objectIdSchema,
  name: z.string(),
  aliases: z.array(z.string()),
  category: exerciseCategorySchema,
  equipment: equipmentSchema,
  primaryMuscles: z.array(muscleGroupSchema),
  secondaryMuscles: z.array(muscleGroupSchema),
  description: z.string().nullable(),
  executionNotes: z.string().nullable(),
  videoUrl: z.string().nullable(),
  /** `global`: Katalog des Sysadmins, `own`: eigene Übung des anfragenden Coaches. */
  scope: z.enum(exerciseScopes),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const exerciseListQuerySchema = paginationQuerySchema.extend({
  /** Sucht in Name und Synonymen, unabhängig von Groß-/Kleinschreibung und Umlauten. */
  search: z.string().trim().max(80).optional(),
  /** Trifft primäre und sekundäre Muskelgruppen. */
  muscle: muscleGroupSchema.optional(),
  equipment: equipmentSchema.optional(),
  category: exerciseCategorySchema.optional(),
  /** Nur für Coaches: nur Katalog oder nur eigene. Ohne Angabe beides. */
  scope: z.enum(exerciseScopes).optional(),
  /** `false` (Standard): nur aktive, `true`: nur archivierte. */
  archived: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const exerciseListResponseSchema = z.object({
  items: z.array(exerciseSchema),
  total: z.number().int(),
});

export type Exercise = z.infer<typeof exerciseSchema>;
export type CreateExerciseRequest = z.input<typeof createExerciseRequestSchema>;
export type UpdateExerciseRequest = z.input<typeof updateExerciseRequestSchema>;
export type ExerciseListQuery = z.input<typeof exerciseListQuerySchema>;
export type ExerciseListResponse = z.infer<typeof exerciseListResponseSchema>;
