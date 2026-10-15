import {
  exerciseSearchKey,
  type ExerciseListResponse,
  type createExerciseRequestSchema,
  type exerciseListQuerySchema,
  type updateExerciseRequestSchema,
} from "@athletept/shared";
import { Types, type PipelineStage } from "mongoose";
import type { z } from "zod";

import { AppError, ForbiddenError, NotFoundError } from "../../lib/errors";
import type { AuthContext } from "../../types/express";
import { ExerciseModel, toExerciseDto, type ExerciseDocument } from "./exercise.model";

type ListQuery = z.output<typeof exerciseListQuerySchema>;
type CreateInput = z.output<typeof createExerciseRequestSchema>;
type UpdateInput = z.output<typeof updateExerciseRequestSchema>;

/** Katalog, in dem der Anfragende anlegt und bearbeitet: Coach eigene, Sysadmin globale. */
function ownerOf(auth: AuthContext) {
  return auth.role === "coach" ? new Types.ObjectId(auth.userId) : null;
}

/** Was der Anfragende sehen darf: Coaches globale und eigene, der Sysadmin nur globale. */
function visibleFilter(auth: AuthContext) {
  return auth.role === "coach"
    ? { ownerCoachId: { $in: [null, new Types.ObjectId(auth.userId)] } }
    : { ownerCoachId: null };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listExercises(
  auth: AuthContext,
  query: ListQuery,
): Promise<ExerciseListResponse> {
  const match: Record<string, unknown> = {
    ...visibleFilter(auth),
    archivedAt: query.archived ? { $ne: null } : null,
  };
  if (auth.role === "coach" && query.scope) {
    match.ownerCoachId = query.scope === "own" ? new Types.ObjectId(auth.userId) : null;
  }
  if (query.equipment) match.equipment = query.equipment;
  if (query.category) match.category = query.category;
  if (query.muscle) {
    match.$or = [{ primaryMuscles: query.muscle }, { secondaryMuscles: query.muscle }];
  }

  // Relevanz: Name beginnt mit dem Suchbegriff, dann ein Wort im Namen, dann der Rest (Synonyme).
  const key = exerciseSearchKey(query.search ?? "");
  const pipeline: PipelineStage[] = [];
  if (key) {
    const contains = new RegExp(escapeRegex(key));
    pipeline.push(
      { $match: { ...match, $and: [{ $or: [{ searchKey: contains }, { aliasKeys: contains }] }] } },
      {
        $addFields: {
          rank: {
            $cond: [
              { $regexMatch: { input: "$searchKey", regex: `^${escapeRegex(key)}` } },
              0,
              {
                $cond: [
                  { $regexMatch: { input: "$searchKey", regex: `(^| )${escapeRegex(key)}` } },
                  1,
                  2,
                ],
              },
            ],
          },
        },
      },
      { $sort: { rank: 1, searchKey: 1 } },
    );
  } else {
    pipeline.push({ $match: match }, { $sort: { searchKey: 1 } });
  }
  pipeline.push({
    $facet: {
      items: [{ $skip: (query.page - 1) * query.pageSize }, { $limit: query.pageSize }],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await ExerciseModel.aggregate<{
    items: ExerciseDocument[];
    total: { count: number }[];
  }>(pipeline);
  return {
    items: (result?.items ?? []).map(toExerciseDto),
    total: result?.total[0]?.count ?? 0,
  };
}

export async function getExercise(auth: AuthContext, id: string) {
  const exercise = await ExerciseModel.findOne({ _id: id, ...visibleFilter(auth) });
  if (!exercise) throw new NotFoundError("Übung nicht gefunden");
  return toExerciseDto(exercise);
}

/**
 * Lädt eine Übung zum Ändern. Coaches dürfen nur eigene ändern; globale sehen sie zwar, bekommen
 * aber 403. Fremde eigene Übungen liefern 404, damit sich ihre IDs nicht erraten lassen.
 */
async function findEditable(auth: AuthContext, id: string) {
  const exercise = await ExerciseModel.findOne({ _id: id, ...visibleFilter(auth) });
  if (!exercise) throw new NotFoundError("Übung nicht gefunden");
  if (String(exercise.ownerCoachId ?? null) !== String(ownerOf(auth))) {
    throw new ForbiddenError(
      "Übungen aus dem Katalog kann nur der Sysadmin ändern. Lege bei Bedarf eine eigene Übung an.",
      "exercise_readonly",
    );
  }
  return exercise;
}

/** Namen sind pro Katalog eindeutig (aktive Übungen). Globale und eigene dürfen gleich heißen. */
async function assertNameFree(
  owner: Types.ObjectId | null,
  searchKey: string,
  exceptId?: Types.ObjectId,
) {
  const taken = await ExerciseModel.exists({
    ownerCoachId: owner,
    searchKey,
    archivedAt: null,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (taken) {
    const message = owner
      ? "Du hast bereits eine Übung mit diesem Namen"
      : "Im Katalog gibt es bereits eine Übung mit diesem Namen";
    throw new AppError(409, "exercise_name_taken", message, [{ path: "name", message }]);
  }
}

function searchFields(name: string, aliases: string[]) {
  return {
    searchKey: exerciseSearchKey(name),
    aliasKeys: aliases.map(exerciseSearchKey).filter(Boolean),
  };
}

export async function createExercise(auth: AuthContext, input: CreateInput) {
  const owner = ownerOf(auth);
  const keys = searchFields(input.name, input.aliases);
  await assertNameFree(owner, keys.searchKey);
  const exercise = await ExerciseModel.create({ ...input, ...keys, ownerCoachId: owner });
  return toExerciseDto(exercise);
}

export async function updateExercise(auth: AuthContext, id: string, input: UpdateInput) {
  const exercise = await findEditable(auth, id);
  const name = input.name ?? exercise.name;
  const aliases = input.aliases ?? [...exercise.aliases];
  const keys = searchFields(name, aliases);
  if (!exercise.archivedAt && keys.searchKey !== exercise.searchKey) {
    await assertNameFree(exercise.ownerCoachId ?? null, keys.searchKey, exercise._id);
  }
  exercise.set({ ...input, ...keys });
  await exercise.save();
  return toExerciseDto(exercise);
}

/** Archivierte Übungen tauchen in der Auswahl nicht mehr auf, bestehende Pläne behalten sie. */
export async function archiveExercise(auth: AuthContext, id: string) {
  const exercise = await findEditable(auth, id);
  if (!exercise.archivedAt) {
    exercise.archivedAt = new Date();
    await exercise.save();
  }
  return toExerciseDto(exercise);
}

export async function restoreExercise(auth: AuthContext, id: string) {
  const exercise = await findEditable(auth, id);
  if (exercise.archivedAt) {
    await assertNameFree(exercise.ownerCoachId ?? null, exercise.searchKey, exercise._id);
    exercise.archivedAt = null;
    await exercise.save();
  }
  return toExerciseDto(exercise);
}
