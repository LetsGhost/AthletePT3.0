import type { replaceExerciseRequestSchema } from "@athletept/shared";
import { Types, type ClientSession } from "mongoose";
import type { z } from "zod";

import { withTransaction } from "../../lib/db";
import { NotFoundError, ValidationError } from "../../lib/errors";
import type { AuthContext } from "../../types/express";
import { getAthleteOfCoach } from "../athletes/athlete-access";
import { PlanTemplateModel } from "../plans/plan-template.model";
import { TrainingPlanModel, TrainingPlanVersionModel } from "../plans/plan.model";
import { computeWorkoutStats, WORKOUT_STATS_VERSION } from "../stats/exercise-stats.service";
import { WorkoutLogModel, type StoredWorkoutLog } from "../workouts/workout-log.model";
import { ExerciseNoticeModel } from "./exercise-notice.model";
import { ExerciseModel, toExerciseDto, type ExerciseDocument } from "./exercise.model";

type ReplaceInput = z.output<typeof replaceExerciseRequestSchema>;

/** Sicherheitsgrenze für Ketten X → Y → Z. Durch das Abflachen beim Ersetzen reicht meist einer. */
const MAX_MERGE_HOPS = 10;

/**
 * Nachfolgerin jeder ersetzten Übung unter `ids`, z. B. für einen Plan-Editor, der vor dem
 * Ersetzen geöffnet wurde. Nicht ersetzte IDs fehlen in der Map.
 */
export async function resolveMerged(
  ids: readonly (Types.ObjectId | string)[],
  session?: ClientSession,
) {
  const redirects = new Map<string, string>();
  let pending = [...new Set(ids.map(String))];
  for (let hop = 0; hop < MAX_MERGE_HOPS && pending.length > 0; hop += 1) {
    const merged = await ExerciseModel.find(
      { _id: { $in: pending }, mergedIntoId: { $ne: null } },
      { mergedIntoId: 1 },
    ).session(session ?? null);
    pending = [];
    for (const exercise of merged) {
      const next = exercise.mergedIntoId!.toString();
      redirects.set(exercise._id.toString(), next);
      pending.push(next);
    }
  }
  // Ketten auf das letzte Glied verkürzen.
  for (const [from, to] of redirects) {
    let end = to;
    for (let hop = 0; hop < MAX_MERGE_HOPS && redirects.has(end); hop += 1)
      end = redirects.get(end)!;
    redirects.set(from, end);
  }
  return redirects;
}

/** Schreibt alle Verweise in Plan-Inhalten (Pläne, Versionen, Vorlagen) um. */
async function rewritePlanContent(
  source: Types.ObjectId,
  target: Pick<ExerciseDocument, "_id" | "name">,
  session: ClientSession,
) {
  const filter = {
    $or: [{ "days.exercises.exerciseId": source }, { "days.warmup.exerciseId": source }],
  };
  const update = {
    $set: {
      "days.$[].exercises.$[x].exerciseId": target._id,
      "days.$[].exercises.$[x].exerciseName": target.name,
      "days.$[].warmup.$[w].exerciseId": target._id,
      "days.$[].warmup.$[w].name": target.name,
    },
  };
  const options = {
    arrayFilters: [{ "x.exerciseId": source }, { "w.exerciseId": source }],
    session,
  };
  await TrainingPlanModel.updateMany(filter, update, options);
  await TrainingPlanVersionModel.updateMany(filter, update, options);
  await PlanTemplateModel.updateMany(filter, update, options);
}

/**
 * Schreibt die Verweise in Protokollen um und berechnet die Kennzahlen abgeschlossener Trainings
 * neu: Kamen dort Quelle und Ziel vor, zählen sie danach als eine Übung.
 */
async function rewriteWorkoutLogs(
  source: Types.ObjectId,
  target: Pick<ExerciseDocument, "_id" | "name">,
  session: ClientSession,
) {
  const affected = await WorkoutLogModel.find({ "exercises.exerciseId": source }, { _id: 1 })
    .session(session)
    .lean();
  if (affected.length === 0) return;
  const ids = affected.map((log) => log._id);
  await WorkoutLogModel.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        "exercises.$[x].exerciseId": target._id,
        "exercises.$[x].exerciseName": target.name,
      },
    },
    { arrayFilters: [{ "x.exerciseId": source }], session },
  );
  const completed = await WorkoutLogModel.find(
    { _id: { $in: ids }, status: "completed" },
    { exercises: 1 },
  )
    .session(session)
    .lean<Pick<StoredWorkoutLog, "_id" | "exercises">[]>();
  if (completed.length === 0) return;
  await WorkoutLogModel.bulkWrite(
    completed.map((log) => ({
      updateOne: {
        filter: { _id: log._id },
        update: {
          $set: { stats: computeWorkoutStats(log.exercises), statsVersion: WORKOUT_STATS_VERSION },
        },
      },
    })),
    { session },
  );
}

/**
 * Lädt die zu ersetzende Übung: beim Coach eine aktive private Übung eines eigenen Athleten, beim
 * Sysadmin eine vorgeschlagene Coach-Übung. Sonst 404.
 */
async function findSource(auth: AuthContext, id: string, session: ClientSession) {
  const filter =
    auth.role === "coach"
      ? { ownerAthleteId: { $ne: null } }
      : { ownerCoachId: { $ne: null }, submittedAt: { $ne: null } };
  const source = await ExerciseModel.findOne({ _id: id, ...filter, archivedAt: null }).session(
    session,
  );
  if (!source) throw new NotFoundError("Übung nicht gefunden");
  if (auth.role === "coach") {
    await getAthleteOfCoach(auth.userId, source.ownerAthleteId!.toString(), session);
  }
  return source;
}

/** Ersatz muss aktiv sein und im Katalog des Anfragenden stehen (Coach: global oder eigene). */
async function findTarget(
  auth: AuthContext,
  source: ExerciseDocument,
  targetId: string,
  session: ClientSession,
) {
  const invalid = (message: string) => new ValidationError([{ path: "targetId", message }]);
  if (targetId === source._id.toString()) {
    throw invalid("Wähle eine andere Übung als Ersatz");
  }
  const owners =
    auth.role === "coach"
      ? [{ ownerCoachId: null }, { ownerCoachId: new Types.ObjectId(auth.userId) }]
      : [{ ownerCoachId: null }];
  const target = await ExerciseModel.findOne({
    _id: targetId,
    ownerAthleteId: null,
    $or: owners,
    archivedAt: null,
  }).session(session);
  if (!target) throw invalid("Diese Übung kannst du nicht als Ersatz wählen");
  return target;
}

/**
 * Ersetzt eine Übung durch eine Katalogübung: Alle Pläne, Versionen, Vorlagen und Protokolle
 * verwenden danach das Ziel, die Statistik läuft dort weiter. Die Quelle wird archiviert und
 * zeigt auf das Ziel (`mergedIntoId`), ihr bisheriger Besitzer bekommt einen Hinweis.
 */
export async function replaceExercise(auth: AuthContext, id: string, input: ReplaceInput) {
  return withTransaction(async (session) => {
    const source = await findSource(auth, id, session);
    const target = await findTarget(auth, source, input.targetId, session);
    const recipientId = source.ownerAthleteId ?? source.ownerCoachId!;

    await rewritePlanContent(source._id, target, session);
    await rewriteWorkoutLogs(source._id, target, session);
    // Früher auf die Quelle umgeleitete Übungen zeigen direkt aufs Ziel.
    await ExerciseModel.updateMany(
      { mergedIntoId: source._id },
      { mergedIntoId: target._id },
      { session },
    );
    source.set({ archivedAt: new Date(), submittedAt: null, mergedIntoId: target._id });
    await source.save({ session });
    await ExerciseNoticeModel.create(
      [
        {
          recipientId,
          kind: "replaced",
          exerciseId: source._id,
          exerciseName: source.name,
          replacementName: target.name,
          reason: input.reason,
        },
      ],
      { session },
    );
    return toExerciseDto(target);
  });
}
