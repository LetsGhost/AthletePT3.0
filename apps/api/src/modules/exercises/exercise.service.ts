import {
  exerciseSearchKey,
  type ExerciseListResponse,
  type ExerciseNoticeListResponse,
  type OwnedExerciseListResponse,
  type createExerciseRequestSchema,
  type exerciseListQuerySchema,
  type updateExerciseRequestSchema,
} from "@athletept/shared";
import { Types, type ClientSession, type PipelineStage } from "mongoose";
import type { z } from "zod";

import { withTransaction } from "../../lib/db";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { writeSource } from "../api-keys/write-source";
import type { AuthContext } from "../../types/express";
import { getAccessibleAthlete, getAthleteOfCoach } from "../athletes/athlete-access";
import { UserModel } from "../users/user.model";
import { ExerciseNoticeModel, toExerciseNoticeDto } from "./exercise-notice.model";
import { ExerciseModel, toExerciseDto, type ExerciseDocument } from "./exercise.model";

type ListQuery = z.output<typeof exerciseListQuerySchema>;
type CreateInput = z.output<typeof createExerciseRequestSchema>;
type UpdateInput = z.output<typeof updateExerciseRequestSchema>;

/** Besitzer einer Übung. Beide `null`: globaler Katalog. */
interface Owner {
  ownerCoachId: Types.ObjectId | null;
  ownerAthleteId: Types.ObjectId | null;
}

/** Wessen Übungen der Anfragende neben dem globalen Katalog sieht. */
interface Catalog {
  coachId: Types.ObjectId | null;
  athleteId: Types.ObjectId | null;
}

const GLOBAL: Owner = { ownerCoachId: null, ownerAthleteId: null };

/**
 * Coaches sehen ihre eigenen Übungen, Athleten mit eigenem Trainingsplan die ihres Coaches und
 * ihre privaten (ohne Berechtigung 403), der Sysadmin nur den globalen Katalog.
 */
async function catalogOf(auth: AuthContext): Promise<Catalog> {
  if (auth.role === "coach") return { coachId: new Types.ObjectId(auth.userId), athleteId: null };
  if (auth.role === "athlete") {
    const athlete = await getAccessibleAthlete(auth, auth.userId, "ownPlan");
    return { coachId: athlete.coachId ?? null, athleteId: athlete._id };
  }
  return { coachId: null, athleteId: null };
}

/** Katalog, in dem der Anfragende anlegt und bearbeitet: privat, eigener oder global. */
function ownerOf(auth: AuthContext, catalog: Catalog): Owner {
  if (auth.role === "athlete") return { ownerCoachId: null, ownerAthleteId: catalog.athleteId };
  if (auth.role === "coach") return { ownerCoachId: catalog.coachId, ownerAthleteId: null };
  return GLOBAL;
}

function visibleFilter(catalog: Catalog) {
  return {
    $or: [
      GLOBAL,
      ...(catalog.coachId ? [{ ownerCoachId: catalog.coachId }] : []),
      ...(catalog.athleteId ? [{ ownerAthleteId: catalog.athleteId }] : []),
    ],
  };
}

/** Filter für `scope`, `null`, wenn der Anfragende diesen Katalog nicht hat (dann alles). */
function scopeFilter(catalog: Catalog, scope: ListQuery["scope"]) {
  if (scope === "global") return GLOBAL;
  if (scope === "own" && catalog.coachId) return { ownerCoachId: catalog.coachId };
  if (scope === "private" && catalog.athleteId) return { ownerAthleteId: catalog.athleteId };
  return null;
}

function sameOwner(exercise: Pick<ExerciseDocument, keyof Owner>, owner: Owner) {
  return (
    String(exercise.ownerCoachId ?? null) === String(owner.ownerCoachId) &&
    String(exercise.ownerAthleteId ?? null) === String(owner.ownerAthleteId)
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listExercises(
  auth: AuthContext,
  query: ListQuery,
): Promise<ExerciseListResponse> {
  const catalog = await catalogOf(auth);
  const conditions: object[] = [visibleFilter(catalog)];
  const scoped = scopeFilter(catalog, query.scope);
  if (scoped) conditions.push(scoped);
  if (query.muscle) {
    conditions.push({
      $or: [{ primaryMuscles: query.muscle }, { secondaryMuscles: query.muscle }],
    });
  }
  const match: Record<string, unknown> = {
    $and: conditions,
    archivedAt: query.archived ? { $ne: null } : null,
    // Ersetzte Übungen sind auch archiviert nicht mehr relevant, Verweise zeigen aufs Ziel.
    mergedIntoId: null,
  };
  if (query.equipment) match.equipment = query.equipment;
  if (query.category) match.category = query.category;

  // Relevanz: Name beginnt mit dem Suchbegriff, dann ein Wort im Namen, dann der Rest (Synonyme).
  const key = exerciseSearchKey(query.search ?? "");
  const pipeline: PipelineStage[] = [];
  if (key) {
    const contains = new RegExp(escapeRegex(key));
    conditions.push({ $or: [{ searchKey: contains }, { aliasKeys: contains }] });
    pipeline.push(
      { $match: match },
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
  const exercise = await ExerciseModel.findOne({
    _id: id,
    ...visibleFilter(await catalogOf(auth)),
  });
  if (!exercise) throw new NotFoundError("Übung nicht gefunden");
  return toExerciseDto(exercise);
}

/**
 * Lädt eine Übung zum Ändern. Jeder ändert nur Übungen seines Katalogs; sichtbare andere (globale,
 * beim Athleten die des Coaches) liefern 403. Unsichtbare liefern 404, damit sich ihre IDs nicht
 * erraten lassen. Das gilt auch für private Übungen der Athleten gegenüber ihrem Coach.
 */
async function findEditable(auth: AuthContext, id: string) {
  const catalog = await catalogOf(auth);
  const owner = ownerOf(auth, catalog);
  const exercise = await ExerciseModel.findOne({ _id: id, ...visibleFilter(catalog) });
  if (!exercise) throw new NotFoundError("Übung nicht gefunden");
  if (exercise.mergedIntoId) {
    throw new ConflictError(
      "Diese Übung wurde durch eine andere ersetzt und lässt sich nicht mehr ändern.",
      "exercise_merged",
    );
  }
  if (!sameOwner(exercise, owner)) {
    throw new ForbiddenError(
      auth.role === "athlete"
        ? "Diese Übung gehört zum Katalog. Ändern kann sie nur dein Coach."
        : "Übungen aus dem Katalog kann nur der Sysadmin ändern. Lege bei Bedarf eine eigene Übung an.",
      "exercise_readonly",
    );
  }
  return { exercise, catalog };
}

/** Namen sind pro Katalog eindeutig (aktive Übungen). Globale und eigene dürfen gleich heißen. */
/** Zusatz zur Namens-Fehlermeldung beim Übernehmen: Statt zu übernehmen kann man ersetzen. */
const REPLACE_HINT = ". Ersetze die Übung stattdessen durch die vorhandene.";

async function assertNameFree(
  owner: Owner,
  searchKey: string,
  exceptId?: Types.ObjectId,
  session?: ClientSession,
  hint = "",
) {
  const taken = await ExerciseModel.exists({
    ...owner,
    searchKey,
    archivedAt: null,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }).session(session ?? null);
  if (taken) {
    const message =
      owner.ownerCoachId || owner.ownerAthleteId
        ? "Du hast bereits eine Übung mit diesem Namen"
        : "Im Katalog gibt es bereits eine Übung mit diesem Namen";
    throw new AppError(409, "exercise_name_taken", message + hint, [{ path: "name", message }]);
  }
}

/**
 * Athleten legen nur an, was es noch nicht gibt: Kein Name oder Synonym darf Name oder Synonym
 * einer sichtbaren Übung (global, des Coaches, eigene private) treffen. Sonst sollen sie die
 * vorhandene verwenden.
 */
async function assertNotInCatalog(
  catalog: Catalog,
  keys: ReturnType<typeof searchFields>,
  exceptId?: Types.ObjectId,
) {
  const all = [keys.searchKey, ...keys.aliasKeys];
  const existing = await ExerciseModel.findOne({
    $and: [
      visibleFilter(catalog),
      { $or: [{ searchKey: { $in: all } }, { aliasKeys: { $in: all } }] },
    ],
    archivedAt: null,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (existing) {
    const byName =
      existing.searchKey === keys.searchKey || existing.aliasKeys.includes(keys.searchKey);
    const message = `„${existing.name}“ gibt es schon. Verwende bitte diese Übung.`;
    throw new AppError(409, "exercise_exists", message, [
      { path: byName ? "name" : "aliases", message },
    ]);
  }
}

function searchFields(name: string, aliases: string[]) {
  return {
    searchKey: exerciseSearchKey(name),
    aliasKeys: aliases.map(exerciseSearchKey).filter(Boolean),
  };
}

/** Prüft einen neuen oder geänderten Namen samt Synonymen für den Katalog von `owner`. */
async function assertAvailable(
  auth: AuthContext,
  catalog: Catalog,
  owner: Owner,
  keys: ReturnType<typeof searchFields>,
  exceptId?: Types.ObjectId,
) {
  if (auth.role === "athlete") await assertNotInCatalog(catalog, keys, exceptId);
  else await assertNameFree(owner, keys.searchKey, exceptId);
}

export async function createExercise(auth: AuthContext, input: CreateInput) {
  const catalog = await catalogOf(auth);
  const owner = ownerOf(auth, catalog);
  const keys = searchFields(input.name, input.aliases);
  await assertAvailable(auth, catalog, owner, keys);
  const exercise = await ExerciseModel.create({
    ...input,
    ...keys,
    ...owner,
    lastWriteVia: writeSource(auth),
  });
  return toExerciseDto(exercise);
}

export async function updateExercise(auth: AuthContext, id: string, input: UpdateInput) {
  const { exercise, catalog } = await findEditable(auth, id);
  const name = input.name ?? exercise.name;
  const aliases = input.aliases ?? [...exercise.aliases];
  const keys = searchFields(name, aliases);
  const changed =
    keys.searchKey !== exercise.searchKey ||
    (auth.role === "athlete" && keys.aliasKeys.join("\n") !== exercise.aliasKeys.join("\n"));
  if (!exercise.archivedAt && changed) {
    await assertAvailable(auth, catalog, ownerOf(auth, catalog), keys, exercise._id);
  }
  exercise.set({ ...input, ...keys, lastWriteVia: writeSource(auth) });
  await exercise.save();
  return toExerciseDto(exercise);
}

/**
 * Archivierte Übungen tauchen in der Auswahl nicht mehr auf, bestehende Pläne behalten sie.
 * Ein Vorschlag für den globalen Katalog wird dabei zurückgezogen.
 */
export async function archiveExercise(auth: AuthContext, id: string) {
  const { exercise } = await findEditable(auth, id);
  if (!exercise.archivedAt) {
    exercise.archivedAt = new Date();
    exercise.submittedAt = null;
    exercise.set({ lastWriteVia: writeSource(auth) });
    await exercise.save();
  }
  return toExerciseDto(exercise);
}

export async function restoreExercise(auth: AuthContext, id: string) {
  const { exercise, catalog } = await findEditable(auth, id);
  if (exercise.archivedAt) {
    const keys = { searchKey: exercise.searchKey, aliasKeys: [...exercise.aliasKeys] };
    await assertAvailable(auth, catalog, ownerOf(auth, catalog), keys, exercise._id);
    exercise.archivedAt = null;
    exercise.set({ lastWriteVia: writeSource(auth) });
    await exercise.save();
  }
  return toExerciseDto(exercise);
}

/** Hängt den Namen des Besitzers an (`ownerId` ist Athlet oder Coach). */
async function withOwners<T extends Parameters<typeof toExerciseDto>[0]>(
  exercises: T[],
  ownerId: (x: T) => string,
) {
  const users = await UserModel.find({ _id: { $in: exercises.map(ownerId) } }, { name: 1 });
  const names = new Map(users.map((u) => [u._id.toString(), u.name]));
  return {
    items: exercises.map((x) => ({
      ...toExerciseDto(x),
      owner: { id: ownerId(x), name: names.get(ownerId(x)) ?? "" },
    })),
  };
}

/** Aktive private Übungen der eigenen Athleten, neueste zuerst. */
export async function listAthleteExercises(auth: AuthContext): Promise<OwnedExerciseListResponse> {
  const athletes = await UserModel.find({ role: "athlete", coachId: auth.userId })
    .select("_id")
    .lean();
  const exercises = await ExerciseModel.find({
    ownerAthleteId: { $in: athletes.map((a) => a._id) },
    archivedAt: null,
  }).sort({ createdAt: -1 });
  return withOwners(exercises, (x) => String(x.ownerAthleteId));
}

/**
 * Übernimmt eine private Übung eines eigenen Athleten in den Katalog des Coaches. Der Athlet
 * verliert das Bearbeitungsrecht, sieht sie aber weiter (als Übung seines Coaches) und bekommt
 * einen Hinweis. Fremde, archivierte und nicht private Übungen liefern 404.
 */
export async function adoptExercise(auth: AuthContext, id: string) {
  return withTransaction(async (session) => {
    const exercise = await ExerciseModel.findOne({
      _id: id,
      ownerAthleteId: { $ne: null },
      archivedAt: null,
    }).session(session);
    if (!exercise) throw new NotFoundError("Übung nicht gefunden");
    const athleteId = exercise.ownerAthleteId!;
    await getAthleteOfCoach(auth.userId, athleteId.toString(), session);

    const owner = { ownerCoachId: new Types.ObjectId(auth.userId), ownerAthleteId: null };
    await assertNameFree(owner, exercise.searchKey, undefined, session, REPLACE_HINT);
    exercise.set(owner);
    await exercise.save({ session });
    await ExerciseNoticeModel.create(
      [
        {
          recipientId: athleteId,
          kind: "adopted",
          exerciseId: exercise._id,
          exerciseName: exercise.name,
        },
      ],
      { session },
    );
    return toExerciseDto(exercise);
  });
}

/** Schlägt eine eigene Übung für den globalen Katalog vor oder zieht den Vorschlag zurück. */
export async function setSubmitted(auth: AuthContext, id: string, submitted: boolean) {
  const { exercise } = await findEditable(auth, id);
  if (submitted && exercise.archivedAt) {
    throw new ConflictError(
      "Archivierte Übungen lassen sich nicht vorschlagen",
      "exercise_archived",
    );
  }
  if (Boolean(exercise.submittedAt) !== submitted) {
    exercise.submittedAt = submitted ? new Date() : null;
    await exercise.save();
  }
  return toExerciseDto(exercise);
}

/** Vorgeschlagene Coach-Übungen, älteste zuerst. */
export async function listSubmissions(): Promise<OwnedExerciseListResponse> {
  const exercises = await ExerciseModel.find({
    ownerCoachId: { $ne: null },
    submittedAt: { $ne: null },
    archivedAt: null,
  }).sort({ submittedAt: 1 });
  return withOwners(exercises, (x) => String(x.ownerCoachId));
}

/**
 * Übernimmt eine vorgeschlagene Coach-Übung in den globalen Katalog. Der Coach verliert das
 * Bearbeitungsrecht und bekommt einen Hinweis. Nicht vorgeschlagene liefern 404.
 */
export async function publishExercise(id: string) {
  return withTransaction(async (session) => {
    const exercise = await ExerciseModel.findOne({
      _id: id,
      ownerCoachId: { $ne: null },
      submittedAt: { $ne: null },
      archivedAt: null,
    }).session(session);
    if (!exercise) throw new NotFoundError("Übung nicht gefunden");
    const coachId = exercise.ownerCoachId!;

    await assertNameFree(GLOBAL, exercise.searchKey, undefined, session, REPLACE_HINT);
    exercise.set({ ...GLOBAL, submittedAt: null });
    await exercise.save({ session });
    await ExerciseNoticeModel.create(
      [
        {
          recipientId: coachId,
          kind: "published",
          exerciseId: exercise._id,
          exerciseName: exercise.name,
        },
      ],
      { session },
    );
    return toExerciseDto(exercise);
  });
}

export async function listNotices(auth: AuthContext): Promise<ExerciseNoticeListResponse> {
  const notices = await ExerciseNoticeModel.find({ recipientId: auth.userId }).sort({
    createdAt: -1,
  });
  return { items: notices.map(toExerciseNoticeDto) };
}

export async function dismissNotice(auth: AuthContext, id: string) {
  const { deletedCount } = await ExerciseNoticeModel.deleteOne({
    _id: id,
    recipientId: auth.userId,
  });
  if (deletedCount === 0) throw new NotFoundError("Hinweis nicht gefunden");
}
