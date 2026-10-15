import {
  detectPlanType,
  type FieldError,
  type PlanDay,
  type PlanExerciseInfo,
  type PlanTypeInput,
  type planContentSchema,
} from "@athletept/shared";
import { Types, type ClientSession } from "mongoose";
import type { z } from "zod";

import { AppError, ValidationError } from "../../lib/errors";
import { ExerciseModel, type ExerciseDocument } from "../exercises/exercise.model";
import type { StoredContent, StoredDay } from "./plan-content.model";

type ContentInput = z.output<typeof planContentSchema>;

/** Gespeicherter Inhalt ohne `revision` (die verwaltet der Aufrufer). */
export type BuiltContent = Omit<StoredContent, "revision">;

function isVisibleTo(exercise: Pick<ExerciseDocument, "ownerCoachId">, coachId: string) {
  return !exercise.ownerCoachId || exercise.ownerCoachId.toString() === coachId;
}

function allExerciseIds(days: readonly StoredDay[]) {
  return days.flatMap((day) => [
    ...day.exercises.map((x) => x.exerciseId),
    ...day.warmup.flatMap((x) => (x.exerciseId ? [x.exerciseId] : [])),
  ]);
}

async function loadExercises(ids: readonly (Types.ObjectId | string)[], session?: ClientSession) {
  const unique = [...new Set(ids.map(String))];
  const exercises = await ExerciseModel.find({ _id: { $in: unique } }).session(session ?? null);
  return new Map(exercises.map((x) => [x._id.toString(), x]));
}

/**
 * Prüft und baut den zu speichernden Inhalt aus der Anfrage des Coaches:
 * - Jede Übung muss für den Coach sichtbar und aktiv sein, oder sie steht schon im bisherigen
 *   Inhalt (archivierte Übungen und eigene Übungen eines früheren Coaches bleiben so erhalten).
 * - Übungsnamen setzt der Server: aktueller Name aus dem Katalog, wenn der Coach die Übung sieht,
 *   sonst die bisherige Kopie.
 * - Bestehende IDs bleiben, neue Einträge bekommen eine neue ID. Unbekannte IDs sind ein Fehler.
 * - Der Plan-Typ wird pro Tag und für den ganzen Plan berechnet.
 */
export async function buildContent(
  coachId: string,
  input: ContentInput,
  previous: Pick<StoredContent, "days"> | null,
  session?: ClientSession,
): Promise<BuiltContent> {
  const previousDays = previous?.days ?? [];
  const known = {
    days: new Set(previousDays.map((d) => d._id.toString())),
    exercises: new Set(previousDays.flatMap((d) => d.exercises.map((x) => x._id.toString()))),
    warmup: new Set(previousDays.flatMap((d) => d.warmup.map((x) => x._id.toString()))),
  };
  const previousNames = new Map<string, string>();
  for (const day of previousDays) {
    for (const x of day.exercises) previousNames.set(x.exerciseId.toString(), x.exerciseName);
    for (const x of day.warmup)
      if (x.exerciseId) previousNames.set(x.exerciseId.toString(), x.name);
  }

  const referenced = input.days.flatMap((day) => [
    ...day.exercises.map((x) => x.exerciseId),
    ...day.warmup.flatMap((x) => (x.exerciseId ? [x.exerciseId] : [])),
  ]);
  const exercises = await loadExercises(referenced, session);
  const errors: FieldError[] = [];

  /** Name der Übung oder `null`, wenn sie hier nicht verwendet werden darf. */
  const resolve = (exerciseId: string, path: string) => {
    const exercise = exercises.get(exerciseId);
    const visible = exercise && isVisibleTo(exercise, coachId);
    const kept = previousNames.get(exerciseId);
    if (exercise && visible && (!exercise.archivedAt || kept !== undefined)) {
      return { name: exercise.name, exercise };
    }
    if (exercise && kept !== undefined) {
      return { name: kept, exercise };
    }
    errors.push({
      path,
      message:
        exercise && visible
          ? `„${exercise.name}“ ist archiviert und kann nicht neu eingeplant werden`
          : "Übung nicht gefunden",
    });
    return null;
  };

  const checkId = (id: string | undefined, set: Set<string>, path: string) => {
    if (id && !set.has(id)) errors.push({ path, message: "Unbekannte ID" });
    return id ? new Types.ObjectId(id) : new Types.ObjectId();
  };

  const typeInputs: PlanTypeInput[] = [];
  const days: StoredDay[] = input.days.map((day, d) => {
    const dayTypeInputs: PlanTypeInput[] = [];
    const built: StoredDay = {
      _id: checkId(day.id, known.days, `days.${d}.id`),
      name: day.name,
      weekday: day.weekday,
      type: "FULLBODY",
      warmup: day.warmup.map((item, w) => {
        const path = `days.${d}.warmup.${w}`;
        const resolved = item.exerciseId ? resolve(item.exerciseId, `${path}.exerciseId`) : null;
        return {
          _id: checkId(item.id, known.warmup, `${path}.id`),
          exerciseId: item.exerciseId ? new Types.ObjectId(item.exerciseId) : null,
          name: resolved?.name ?? item.name,
          details: item.details,
        };
      }),
      exercises: day.exercises.map((entry, e) => {
        const path = `days.${d}.exercises.${e}`;
        const resolved = resolve(entry.exerciseId, `${path}.exerciseId`);
        if (resolved) dayTypeInputs.push(resolved.exercise);
        return {
          _id: checkId(entry.id, known.exercises, `${path}.id`),
          exerciseId: new Types.ObjectId(entry.exerciseId),
          exerciseName: resolved?.name ?? "",
          restSeconds: entry.restSeconds,
          notes: entry.notes,
          sets: entry.sets,
        };
      }),
    };
    built.type = detectPlanType(dayTypeInputs);
    typeInputs.push(...dayTypeInputs);
    return built;
  });

  if (errors.length > 0) {
    throw new ValidationError(errors, "Einige Übungen können nicht verwendet werden");
  }
  return { name: input.name, notes: input.notes, type: detectPlanType(typeInputs), days };
}

/** Ein aktiver Plan braucht mindestens einen Tag und pro Tag mindestens eine Übung. */
export function assertComplete(content: Pick<StoredContent, "days">) {
  const errors: FieldError[] = [];
  if (content.days.length === 0) {
    errors.push({ path: "days", message: "Mindestens einen Trainingstag anlegen" });
  }
  content.days.forEach((day, d) => {
    if (day.exercises.length === 0) {
      errors.push({
        path: `days.${d}.exercises`,
        message: `„${day.name}“ braucht mindestens eine Übung`,
      });
    }
  });
  if (errors.length > 0) {
    throw new AppError(
      400,
      "plan_incomplete",
      "Ein aktiver Plan braucht mindestens einen Trainingstag und pro Tag mindestens eine Übung",
      errors,
    );
  }
}

/** Details zu den verwendeten Übungen. `coachId: null` (Athlet): nichts ist auswählbar. */
export async function exerciseInfos(
  days: readonly StoredDay[],
  coachId: string | null,
): Promise<PlanExerciseInfo[]> {
  const exercises = await loadExercises(allExerciseIds(days));
  return [...exercises.values()].map((x) => ({
    id: x._id.toString(),
    name: x.name,
    category: x.category,
    equipment: x.equipment,
    primaryMuscles: [...x.primaryMuscles] as PlanExerciseInfo["primaryMuscles"],
    secondaryMuscles: [...x.secondaryMuscles] as PlanExerciseInfo["secondaryMuscles"],
    description: x.description ?? null,
    executionNotes: x.executionNotes ?? null,
    videoUrl: x.videoUrl ?? null,
    archived: Boolean(x.archivedAt),
    selectable: coachId !== null && isVisibleTo(x, coachId) && !x.archivedAt,
  }));
}

export function toDayDtos(days: readonly StoredDay[]): PlanDay[] {
  return days.map((day) => ({
    id: day._id.toString(),
    name: day.name,
    weekday: day.weekday,
    type: day.type,
    warmup: day.warmup.map((item) => ({
      id: item._id.toString(),
      exerciseId: item.exerciseId ? item.exerciseId.toString() : null,
      name: item.name,
      details: item.details ?? null,
    })),
    exercises: day.exercises.map((entry) => ({
      id: entry._id.toString(),
      exerciseId: entry.exerciseId.toString(),
      exerciseName: entry.exerciseName,
      restSeconds: entry.restSeconds ?? null,
      notes: entry.notes ?? null,
      sets: entry.sets.map((set) => ({
        kind: set.kind,
        repsMin: set.repsMin ?? null,
        repsMax: set.repsMax ?? null,
        durationSeconds: set.durationSeconds ?? null,
        weightKg: set.weightKg ?? null,
        rir: set.rir ?? null,
      })),
    })),
  }));
}

/** Gemeinsame Felder der Antworten für Plan, Version und Vorlage. */
export async function toContentDto(content: StoredContent, coachId: string | null) {
  return {
    name: content.name,
    notes: content.notes ?? null,
    type: content.type,
    revision: content.revision,
    days: toDayDtos(content.days),
    exercises: await exerciseInfos(content.days, coachId),
  };
}
