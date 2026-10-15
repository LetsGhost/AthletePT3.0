import type {
  CreatePlanRequest,
  Exercise,
  PlanDay,
  PlanExerciseInfo,
  planContentSchema,
} from "@athletept/shared";
import type { z } from "zod";

/** Formularwerte des Editors (Eingabeform des Schemas: leere Zahlen sind `undefined`). */
export type EditorValues = z.input<typeof planContentSchema>;
export type EditorOutput = z.output<typeof planContentSchema>;
export type EditorDay = NonNullable<EditorValues["days"]>[number];
export type EditorExercise = NonNullable<EditorDay["exercises"]>[number];
export type EditorSet = EditorExercise["sets"][number];

interface ContentLike {
  name: string;
  notes: string | null;
  days: PlanDay[];
}

const orUndefined = (value: number | null) => value ?? undefined;

/** Plan oder Vorlage als Formularwerte. `keepIds: false` für Kopien (neue Einträge). */
export function toEditorValues(content: ContentLike, { keepIds = true } = {}): EditorValues {
  const id = (value: string) => (keepIds ? { id: value } : {});
  return {
    name: content.name,
    notes: content.notes ?? "",
    days: content.days.map((day) => ({
      ...id(day.id),
      name: day.name,
      weekday: orUndefined(day.weekday),
      warmup: day.warmup.map((item) => ({
        ...id(item.id),
        exerciseId: item.exerciseId,
        name: item.name,
        details: item.details ?? "",
      })),
      exercises: day.exercises.map((entry) => ({
        ...id(entry.id),
        exerciseId: entry.exerciseId,
        restSeconds: orUndefined(entry.restSeconds),
        notes: entry.notes ?? "",
        sets: entry.sets.map((set) => ({
          kind: set.kind,
          repsMin: orUndefined(set.repsMin),
          repsMax: orUndefined(set.repsMax),
          durationSeconds: orUndefined(set.durationSeconds),
          weightKg: orUndefined(set.weightKg),
          rir: orUndefined(set.rir),
        })),
      })),
    })),
  };
}

/** Inhalt als Anfrage für einen neuen Plan bzw. eine neue Vorlage (ohne IDs). */
export function copyContent(content: ContentLike, name = content.name): CreatePlanRequest {
  return { ...toEditorValues(content, { keepIds: false }), name };
}

/** Was der Editor über eine Übung wissen muss (Name, Typ-Erkennung, Hinweise). */
export type ExerciseInfo = PlanExerciseInfo;

export function infoFromExercise(exercise: Exercise): ExerciseInfo {
  return {
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    equipment: exercise.equipment,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    description: exercise.description,
    executionNotes: exercise.executionNotes,
    videoUrl: exercise.videoUrl,
    archived: exercise.archived,
    selectable: !exercise.archived,
  };
}

export const emptySet = (kind: EditorSet["kind"] = "working"): EditorSet => ({ kind });
