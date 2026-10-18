import {
  AVERAGE_DURATION_WORKOUTS,
  WORKOUT_BACKFILL_DAYS,
  WORKOUT_EDIT_DAYS,
  addDays,
  isoWeekOf,
  isoWeekStart,
  todayIsoDate,
  type CompleteWorkoutResponse,
  type PreviousPerformance,
  type WorkoutLog,
  type WorkoutLogListResponse,
  type WorkoutLogSummary,
  type skipWorkoutRequestSchema,
  type startWorkoutRequestSchema,
  type updateWorkoutRequestSchema,
  type workoutLogListQuerySchema,
} from "@athletept/shared";
import { Types } from "mongoose";
import type { z } from "zod";

import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors";
import { getAthleteOfCoach } from "../athletes/athlete-access";
import { durationMinutes } from "../stats/activity.service";
import {
  WORKOUT_STATS_VERSION,
  computeWorkoutStats,
  findNewRecords,
} from "../stats/exercise-stats.service";
import { toDayDtos } from "../plans/plan-content";
import type { StoredDay } from "../plans/plan-content.model";
import { TrainingPlanModel, type StoredPlan } from "../plans/plan.model";
import {
  WorkoutLogModel,
  type StoredWorkoutExercise,
  type StoredWorkoutLog,
  type StoredWorkoutSet,
} from "./workout-log.model";

type StartInput = z.output<typeof startWorkoutRequestSchema>;
type SkipInput = z.output<typeof skipWorkoutRequestSchema>;
type UpdateInput = z.output<typeof updateWorkoutRequestSchema>;
type ListQuery = z.output<typeof workoutLogListQuerySchema>;

const DAY_MS = 86_400_000;

function editableUntil(log: StoredWorkoutLog) {
  return log.completedAt ? new Date(log.completedAt.getTime() + WORKOUT_EDIT_DAYS * DAY_MS) : null;
}

/** Laufende Protokolle immer, abgeschlossene und abgesagte bis `WORKOUT_EDIT_DAYS` danach. */
function isEditable(log: StoredWorkoutLog, now = new Date()) {
  if (log.status === "in_progress") return true;
  const until = editableUntil(log);
  return until !== null && now <= until;
}

function toSetDto(set: StoredWorkoutSet) {
  return {
    kind: set.kind,
    weightKg: set.weightKg ?? null,
    reps: set.reps ?? null,
    durationSeconds: set.durationSeconds ?? null,
    done: Boolean(set.done),
  };
}

export function toSummary(log: StoredWorkoutLog): WorkoutLogSummary {
  return {
    id: log._id.toString(),
    planId: log.planId.toString(),
    dayId: log.dayId.toString(),
    dayName: log.dayName,
    dayType: log.dayType,
    date: log.date,
    status: log.status,
    rating: log.rating ?? null,
    notes: log.notes ?? null,
    exerciseCount: log.exercises.length,
    doneSetCount: log.exercises.reduce(
      (sum, x) => sum + (x.skipped ? 0 : x.sets.filter((s) => s.done).length),
      0,
    ),
    completedAt: log.completedAt?.toISOString() ?? null,
  };
}

/**
 * Zuletzt geschaffte Sätze je Übung aus abgeschlossenen Protokollen bis einschließlich `date`
 * (ohne das Protokoll selbst). Zählt nur Übungen, die nicht ausgelassen wurden und mindestens
 * einen erledigten Satz haben.
 */
async function previousPerformances(
  athleteId: Types.ObjectId,
  exerciseIds: readonly Types.ObjectId[],
  date: string,
  excludeLogId: Types.ObjectId | null,
) {
  const rows = await WorkoutLogModel.aggregate<{
    _id: Types.ObjectId;
    date: string;
    sets: StoredWorkoutSet[];
  }>([
    {
      $match: {
        athleteId,
        status: "completed",
        date: { $lte: date },
        "exercises.exerciseId": { $in: exerciseIds },
        ...(excludeLogId ? { _id: { $ne: excludeLogId } } : {}),
      },
    },
    { $unwind: "$exercises" },
    {
      $match: {
        "exercises.exerciseId": { $in: exerciseIds },
        "exercises.skipped": false,
        "exercises.sets.done": true,
      },
    },
    { $sort: { date: -1, completedAt: -1 } },
    {
      $group: {
        _id: "$exercises.exerciseId",
        date: { $first: "$date" },
        sets: { $first: "$exercises.sets" },
      },
    },
  ]);
  return new Map<string, PreviousPerformance>(
    rows.map((row) => [
      row._id.toString(),
      { date: row.date, sets: row.sets.filter((s) => s.done).map(toSetDto) },
    ]),
  );
}

async function toLogDto(log: StoredWorkoutLog, viewer: "athlete" | "coach"): Promise<WorkoutLog> {
  const previous =
    log.status === "skipped"
      ? new Map<string, PreviousPerformance>()
      : await previousPerformances(
          log.athleteId,
          log.exercises.map((x) => x.exerciseId),
          log.date,
          log._id,
        );
  const until = editableUntil(log);
  return {
    id: log._id.toString(),
    athleteId: log.athleteId.toString(),
    planId: log.planId.toString(),
    planRevision: log.planRevision,
    dayId: log.dayId.toString(),
    dayName: log.dayName,
    dayType: log.dayType,
    date: log.date,
    status: log.status,
    exercises: log.exercises.map((x) => ({
      id: x._id.toString(),
      planExerciseId: x.planExerciseId.toString(),
      exerciseId: x.exerciseId.toString(),
      exerciseName: x.exerciseName,
      restSeconds: x.restSeconds ?? null,
      planNotes: x.planNotes ?? null,
      targets: x.targets.map((t) => ({
        kind: t.kind,
        repsMin: t.repsMin ?? null,
        repsMax: t.repsMax ?? null,
        durationSeconds: t.durationSeconds ?? null,
        weightKg: t.weightKg ?? null,
        rir: t.rir ?? null,
      })),
      skipped: Boolean(x.skipped),
      notes: x.notes ?? null,
      sets: x.sets.map(toSetDto),
      previous: previous.get(x.exerciseId.toString()) ?? null,
    })),
    rating: log.rating ?? null,
    notes: log.notes ?? null,
    revision: log.revision,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    editableUntil: until?.toISOString() ?? null,
    editable: viewer === "athlete" && isEditable(log),
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}

/** Kalendertag prüfen: nicht in der Zukunft, höchstens `WORKOUT_BACKFILL_DAYS` zurück. */
function resolveDate(date: string | undefined) {
  const today = todayIsoDate();
  if (date === undefined) return today;
  if (date > today) {
    throw new ValidationError([{ path: "date", message: "Das Datum liegt in der Zukunft" }]);
  }
  if (date < addDays(today, -WORKOUT_BACKFILL_DAYS)) {
    throw new ValidationError([
      { path: "date", message: `Höchstens ${WORKOUT_BACKFILL_DAYS} Tage zurück` },
    ]);
  }
  return date;
}

/** Aktiver Plan und Tag daraus. Protokolliert wird nur nach dem aktiven Plan. */
async function findActiveDay(athleteId: string, dayId: string) {
  const plan = await TrainingPlanModel.findOne({ athleteId, status: "active" }).lean<StoredPlan>();
  if (!plan) {
    throw new ConflictError("Du hast noch keinen aktiven Trainingsplan.", "no_active_plan");
  }
  const day = plan.days.find((d) => d._id.toString() === dayId);
  if (!day) throw new NotFoundError("Trainingstag nicht gefunden");
  return { plan, day };
}

function workoutInProgress() {
  return new ConflictError(
    "Es läuft schon ein Training. Schließe es ab oder verwirf es, bevor du ein neues startest.",
    "workout_in_progress",
  );
}

/** Übungen des Tages mit Vorgaben; vorbefüllt mit Plangewicht (sonst letztem Gewicht). */
async function exercisesFromDay(
  athleteId: Types.ObjectId,
  day: StoredDay,
  date: string,
): Promise<Omit<StoredWorkoutExercise, "_id">[]> {
  const previous = await previousPerformances(
    athleteId,
    day.exercises.map((x) => x.exerciseId),
    date,
    null,
  );
  const [dto] = toDayDtos([day]);
  return day.exercises.map((entry, e) => {
    const targets = dto!.exercises[e]!.sets;
    const last = previous.get(entry.exerciseId.toString())?.sets ?? [];
    return {
      planExerciseId: entry._id,
      exerciseId: entry.exerciseId,
      exerciseName: entry.exerciseName,
      restSeconds: entry.restSeconds ?? null,
      planNotes: entry.notes ?? null,
      targets,
      skipped: false,
      notes: null,
      sets: targets.map((target, i) => ({
        kind: target.kind,
        weightKg: target.weightKg ?? last[i]?.weightKg ?? null,
        reps: target.repsMax,
        durationSeconds: target.durationSeconds,
        done: false,
      })),
    };
  });
}

async function findOwnLog(athleteId: string, logId: string) {
  const log = await WorkoutLogModel.findOne({ _id: logId, athleteId }).lean<StoredWorkoutLog>();
  if (!log) throw new NotFoundError("Training nicht gefunden");
  return log;
}

async function reload(logId: Types.ObjectId) {
  const log = await WorkoutLogModel.findById(logId).lean<StoredWorkoutLog>();
  if (!log) throw new NotFoundError("Training nicht gefunden");
  return log;
}

/** Startet ein Training nach einem Tag des aktiven Plans. Es darf nur eines gleichzeitig laufen. */
export async function startWorkout(athleteId: string, input: StartInput) {
  const date = resolveDate(input.date);
  const { plan, day } = await findActiveDay(athleteId, input.dayId);
  if (await WorkoutLogModel.exists({ athleteId, status: "in_progress" })) {
    throw workoutInProgress();
  }
  const athleteObjectId = new Types.ObjectId(athleteId);
  let created;
  try {
    created = await WorkoutLogModel.create({
      athleteId,
      planId: plan._id,
      planRevision: plan.revision,
      dayId: day._id,
      dayName: day.name,
      dayType: day.type,
      date,
      status: "in_progress",
      exercises: await exercisesFromDay(athleteObjectId, day, date),
      startedAt: new Date(),
    });
  } catch (error) {
    // Zwei Starts gleichzeitig: der eindeutige Index lässt nur einen durch.
    if ((error as { code?: number }).code === 11000) throw workoutInProgress();
    throw error;
  }
  return toLogDto(await reload(created._id), "athlete");
}

/** Sagt einen Trainingstag ab. Pro Tag und Woche nur, solange er weder erledigt noch abgesagt ist. */
export async function skipWorkout(athleteId: string, input: SkipInput) {
  const date = resolveDate(input.date);
  const { plan, day } = await findActiveDay(athleteId, input.dayId);
  const start = isoWeekStart(isoWeekOf(date));
  const already = await WorkoutLogModel.exists({
    athleteId,
    dayId: day._id,
    status: { $in: ["completed", "skipped"] },
    date: { $gte: start, $lte: addDays(start, 6) },
  });
  if (already) {
    throw new ConflictError(
      `„${day.name}“ ist in dieser Woche schon erledigt oder abgesagt.`,
      "workout_already_logged",
    );
  }
  const now = new Date();
  const created = await WorkoutLogModel.create({
    athleteId,
    planId: plan._id,
    planRevision: plan.revision,
    dayId: day._id,
    dayName: day.name,
    dayType: day.type,
    date,
    status: "skipped",
    exercises: [],
    notes: input.notes,
    startedAt: now,
    completedAt: now,
  });
  return toLogDto(await reload(created._id), "athlete");
}

export async function getMyWorkout(athleteId: string, logId: string) {
  return toLogDto(await findOwnLog(athleteId, logId), "athlete");
}

function workoutConflict() {
  return new ConflictError(
    "Das Training wurde inzwischen an anderer Stelle geändert. Lade es neu.",
    "workout_conflict",
  );
}

function assertEditable(log: StoredWorkoutLog) {
  if (log.status === "skipped") {
    throw new ConflictError(
      "Abgesagte Trainings lassen sich nicht bearbeiten. Nimm die Absage zurück, um zu trainieren.",
      "workout_skipped",
    );
  }
  if (!isEditable(log)) {
    throw new ConflictError(
      `Trainings lassen sich nur ${WORKOUT_EDIT_DAYS} Tage nach dem Abschließen ändern.`,
      "workout_locked",
    );
  }
}

/** Übernimmt die Eingaben. Art und Vorgabe der Sätze bleiben vom Server (Index in `targets`). */
function applyInput(log: StoredWorkoutLog, input: UpdateInput) {
  const byId = new Map(input.exercises.map((x) => [x.id, x]));
  const matches =
    byId.size === input.exercises.length &&
    input.exercises.length === log.exercises.length &&
    log.exercises.every((x) => byId.has(x._id.toString()));
  if (!matches) {
    throw new ValidationError([
      { path: "exercises", message: "Die Übungen passen nicht zu diesem Training" },
    ]);
  }
  const exercises = log.exercises.map((stored) => {
    const entry = byId.get(stored._id.toString())!;
    return {
      ...stored,
      skipped: entry.skipped,
      notes: entry.notes,
      sets: entry.sets.map((set, i) => ({
        kind: stored.targets[i]?.kind ?? "working",
        weightKg: set.weightKg,
        reps: set.reps,
        durationSeconds: set.durationSeconds,
        done: set.done,
      })),
    };
  });
  return { exercises, rating: input.rating, notes: input.notes };
}

async function saveLog(
  log: StoredWorkoutLog,
  input: UpdateInput,
  extra: Partial<Pick<StoredWorkoutLog, "status" | "completedAt">> = {},
) {
  if (log.revision !== input.revision) throw workoutConflict();
  const applied = applyInput(log, input);
  const result = await WorkoutLogModel.updateOne(
    { _id: log._id, revision: input.revision },
    {
      $set: {
        ...applied,
        ...extra,
        stats: computeWorkoutStats(applied.exercises),
        statsVersion: WORKOUT_STATS_VERSION,
      },
      $inc: { revision: 1 },
    },
  );
  if (result.matchedCount === 0) throw workoutConflict();
  return toLogDto(await reload(log._id), "athlete");
}

/** Zwischenspeichern bzw. Korrigieren. Der Status bleibt. */
export async function updateMyWorkout(athleteId: string, logId: string, input: UpdateInput) {
  const log = await findOwnLog(athleteId, logId);
  assertEditable(log);
  return saveLog(log, input);
}

/** Durchschnittliche Dauer der letzten abgeschlossenen Trainings außer `logId`, ohne Ausreißer. */
async function averageDurationMinutes(athleteId: string, logId: Types.ObjectId) {
  const logs = await WorkoutLogModel.find(
    { athleteId, status: "completed", _id: { $ne: logId } },
    { startedAt: 1, completedAt: 1 },
  )
    .sort({ completedAt: -1 })
    .limit(AVERAGE_DURATION_WORKOUTS)
    .lean<Pick<StoredWorkoutLog, "startedAt" | "completedAt">[]>();
  const minutes = logs.map(durationMinutes).filter((m) => m !== null);
  if (minutes.length === 0) return null;
  return Math.round(minutes.reduce((sum, m) => sum + m, 0) / minutes.length);
}

/** Speichert den letzten Stand, schließt das Training ab und meldet neue Bestwerte. */
export async function completeMyWorkout(
  athleteId: string,
  logId: string,
  input: UpdateInput,
): Promise<CompleteWorkoutResponse> {
  const log = await findOwnLog(athleteId, logId);
  if (log.status !== "in_progress") {
    throw new ConflictError("Das Training ist bereits abgeschlossen.", "workout_not_in_progress");
  }
  const completed = await saveLog(log, input, { status: "completed", completedAt: new Date() });
  const [newRecords, average] = await Promise.all([
    findNewRecords(athleteId, log._id),
    averageDurationMinutes(athleteId, log._id),
  ]);
  return { ...completed, newRecords, averageDurationMinutes: average };
}

/** Verwirft ein laufendes Training oder nimmt eine Absage zurück. Erledigtes bleibt. */
export async function deleteMyWorkout(athleteId: string, logId: string) {
  const log = await findOwnLog(athleteId, logId);
  if (log.status === "completed") {
    throw new ConflictError(
      "Abgeschlossene Trainings lassen sich nicht löschen.",
      "workout_completed",
    );
  }
  if (!isEditable(log)) {
    throw new ConflictError(
      `Absagen lassen sich nur ${WORKOUT_EDIT_DAYS} Tage lang zurücknehmen.`,
      "workout_locked",
    );
  }
  await WorkoutLogModel.deleteOne({ _id: log._id });
}

/** Coaches sehen nur abgeschlossene und abgesagte Trainings, keine laufenden. */
const visibleToCoach = { status: { $ne: "in_progress" as const } };

async function listLogs(
  filter: { athleteId: string; status?: (typeof visibleToCoach)["status"] },
  query: ListQuery,
) {
  const [items, total] = await Promise.all([
    WorkoutLogModel.find(filter)
      .sort({ date: -1, startedAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<StoredWorkoutLog[]>(),
    WorkoutLogModel.countDocuments(filter),
  ]);
  return { items: items.map(toSummary), total } satisfies WorkoutLogListResponse;
}

export async function listMyWorkouts(athleteId: string, query: ListQuery) {
  return listLogs({ athleteId }, query);
}

export async function listAthleteWorkouts(coachId: string, athleteId: string, query: ListQuery) {
  await getAthleteOfCoach(coachId, athleteId);
  return listLogs({ athleteId, ...visibleToCoach }, query);
}

export async function getAthleteWorkout(coachId: string, athleteId: string, logId: string) {
  await getAthleteOfCoach(coachId, athleteId);
  const log = await WorkoutLogModel.findOne({
    _id: logId,
    athleteId,
    ...visibleToCoach,
  }).lean<StoredWorkoutLog>();
  if (!log) throw new NotFoundError("Training nicht gefunden");
  return toLogDto(log, "coach");
}
