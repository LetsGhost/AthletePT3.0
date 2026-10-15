import {
  MAX_EXERCISE_SETS,
  type UpdateWorkoutRequest,
  type WorkoutLog,
  type WorkoutSet,
} from "@athletept/shared";

import { decimalToText, parseDecimal } from "./format";

/** Eingaben als Text, damit Zwischenstände wie „82,“ beim Tippen erhalten bleiben. */
export interface DraftSet {
  weight: string;
  reps: string;
  duration: string;
  done: boolean;
}

export interface DraftExercise {
  id: string;
  skipped: boolean;
  notes: string;
  sets: DraftSet[];
}

export interface WorkoutDraft {
  exercises: DraftExercise[];
  rating: number | null;
  notes: string;
}

function toDraftSet(set: Pick<WorkoutSet, "weightKg" | "reps" | "durationSeconds" | "done">) {
  return {
    weight: decimalToText(set.weightKg),
    reps: set.reps === null ? "" : String(set.reps),
    duration: set.durationSeconds === null ? "" : String(set.durationSeconds),
    done: set.done,
  };
}

export function draftFromLog(log: WorkoutLog): WorkoutDraft {
  return {
    exercises: log.exercises.map((x) => ({
      id: x.id,
      skipped: x.skipped,
      notes: x.notes ?? "",
      sets: x.sets.map(toDraftSet),
    })),
    rating: log.rating,
    notes: log.notes ?? "",
  };
}

/** Neuer Satz: übernimmt die Werte des letzten Satzes, noch nicht erledigt. */
export function appendSet(exercise: DraftExercise): DraftExercise {
  if (exercise.sets.length >= MAX_EXERCISE_SETS) return exercise;
  const last = exercise.sets.at(-1);
  return {
    ...exercise,
    sets: [
      ...exercise.sets,
      {
        weight: last?.weight ?? "",
        reps: last?.reps ?? "",
        duration: last?.duration ?? "",
        done: false,
      },
    ],
  };
}

export type DraftErrors = Record<string, string>;

/** Feldschlüssel für Fehler: `0.2.weight` = Übung 0, Satz 2, Gewicht. */
export const fieldKey = (exercise: number, set: number, field: keyof Omit<DraftSet, "done">) =>
  `${exercise}.${set}.${field}`;

function check(
  value: string,
  { integer, max }: { integer: boolean; max: number },
): { value: number | null; error?: string } {
  const parsed = integer
    ? value.trim() === ""
      ? null
      : Number(value.trim())
    : parseDecimal(value);
  if (parsed === null) return { value: null };
  if (Number.isNaN(parsed)) return { value: null, error: "Bitte eine Zahl" };
  if (integer && !Number.isInteger(parsed)) return { value: null, error: "Ganze Zahl" };
  if (parsed < 0) return { value: null, error: "Nicht negativ" };
  if (parsed > max) return { value: null, error: `Höchstens ${max}` };
  return { value: parsed };
}

/** Wandelt den Entwurf in eine Anfrage. Ungültige Felder landen in `errors`. */
export function draftToRequest(
  draft: WorkoutDraft,
  revision: number,
): { body: UpdateWorkoutRequest; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const body: UpdateWorkoutRequest = {
    revision,
    rating: draft.rating,
    notes: draft.notes,
    exercises: draft.exercises.map((exercise, e) => ({
      id: exercise.id,
      skipped: exercise.skipped,
      notes: exercise.notes,
      sets: exercise.sets.map((set, s) => {
        const weight = check(set.weight, { integer: false, max: 1000 });
        const reps = check(set.reps, { integer: true, max: 200 });
        const duration = check(set.duration, { integer: true, max: 3600 });
        if (weight.error) errors[fieldKey(e, s, "weight")] = weight.error;
        if (reps.error) errors[fieldKey(e, s, "reps")] = reps.error;
        if (duration.error) errors[fieldKey(e, s, "duration")] = duration.error;
        return {
          weightKg: weight.value,
          reps: reps.value,
          durationSeconds: duration.value,
          done: set.done,
        };
      }),
    })),
  };
  return { body, errors };
}

/** Erledigte und alle Sätze in nicht ausgelassenen Übungen. */
export function setProgress(draft: WorkoutDraft) {
  return draft.exercises
    .filter((x) => !x.skipped)
    .reduce(
      (sum, x) => ({
        done: sum.done + x.sets.filter((s) => s.done).length,
        total: sum.total + x.sets.length,
      }),
      { done: 0, total: 0 },
    );
}

/** Nicht abgehakte Sätze in nicht ausgelassenen Übungen. */
export function openSetCount(draft: WorkoutDraft) {
  const { done, total } = setProgress(draft);
  return total - done;
}

/** Alle Sätze abgehakt (eine Übung ohne Sätze gilt als offen). */
export function isExerciseComplete(exercise: DraftExercise) {
  return exercise.sets.length > 0 && exercise.sets.every((s) => s.done);
}

interface StoredDraft {
  /** Revision, auf der der Entwurf aufbaut. */
  revision: number;
  draft: WorkoutDraft;
}

const storageKey = (logId: string) => `athletept.workout.${logId}`;

/** Lokaler Puffer für noch nicht gesendete Änderungen (z. B. ohne Netz im Studio). */
export const draftStorage = {
  read(logId: string): StoredDraft | null {
    try {
      const raw = localStorage.getItem(storageKey(logId));
      return raw ? (JSON.parse(raw) as StoredDraft) : null;
    } catch {
      return null;
    }
  },
  write(logId: string, value: StoredDraft) {
    try {
      localStorage.setItem(storageKey(logId), JSON.stringify(value));
    } catch {
      // Speicher voll oder gesperrt: dann bleibt nur der Server.
    }
  },
  remove(logId: string) {
    try {
      localStorage.removeItem(storageKey(logId));
    } catch {
      // ignorieren
    }
  },
};
