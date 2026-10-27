import {
  challengeStatusOn,
  createCoachChallengeRequestSchema,
  todayIsoDate,
  type ChallengeDetail,
  type ChallengeEntry,
  type ChallengeListResponse,
  type ChallengeStanding,
  type ChallengeSummary,
  type ChallengeWorkoutUpdate,
  type updateCoachChallengeRequestSchema,
} from "@athletept/shared";
import { Types } from "mongoose";
import type { z } from "zod";

import { env } from "../../config/env";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors";
import { trySendMail } from "../../lib/mail/mailer";
import { challengeAssignedMail } from "../../lib/mail/templates";
import type { AuthContext } from "../../types/express";
import { getAthleteOfCoach } from "../athletes/athlete-access";
import { getExercise } from "../exercises/exercise.service";
import { UserModel } from "../users/user.model";
import { WorkoutLogModel, type StoredWorkoutLog } from "../workouts/workout-log.model";
import {
  computeStandings,
  type ScoreEntry,
  type ScoreLog,
  type ScoreResult,
} from "./challenge-score";
import {
  ChallengeEntryModel,
  ChallengeModel,
  type StoredChallenge,
  type StoredChallengeEntry,
} from "./challenge.model";

type CreateInput = z.output<typeof createCoachChallengeRequestSchema>;
type UpdateInput = z.output<typeof updateCoachChallengeRequestSchema>;

/** Aus wessen Sicht der Stand gezeigt wird: der Athlet selbst, oder ein Athlet für seinen Coach. */
interface Perspective {
  athleteId: string | null;
  /** Eigene Einträge nur für den Athleten selbst. */
  withEntries: boolean;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const formatDay = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

/** Letzter Tag, der zählt: das Ende oder heute, was früher ist. */
function lastCountingDate(challenge: StoredChallenge, today: string) {
  return challenge.endDate < today ? challenge.endDate : today;
}

type LogForScore = Pick<StoredWorkoutLog, "_id" | "athleteId" | "date" | "completedAt" | "stats">;

function toScoreLog(log: LogForScore): ScoreLog {
  return {
    id: log._id.toString(),
    athleteId: log.athleteId.toString(),
    date: log.date,
    completedAt: log.completedAt,
    stats: log.stats.map((s) => ({
      exerciseId: s.exerciseId.toString(),
      volumeKg: s.volumeKg,
      setCount: s.setCount,
      estimated1rm: s.estimated1rm,
    })),
  };
}

function toScoreEntry(entry: StoredChallengeEntry): ScoreEntry {
  return {
    athleteId: entry.athleteId.toString(),
    date: entry.date,
    value: entry.value,
    updatedAt: entry.updatedAt,
  };
}

/** Trainings bzw. Einträge, aus denen sich der Stand einer Challenge ergibt. */
async function loadScoreData(challenge: StoredChallenge, today: string) {
  const lastDate = lastCountingDate(challenge, today);
  if (lastDate < challenge.startDate || challenge.participantIds.length === 0) {
    return { logs: [], entries: [] };
  }
  const range = { $gte: challenge.startDate, $lte: lastDate };
  if (challenge.metric === "manual") {
    const entries = await ChallengeEntryModel.find({
      challengeId: challenge._id,
      date: range,
    }).lean<StoredChallengeEntry[]>();
    return { logs: [], entries: entries.map(toScoreEntry) };
  }
  const logs = await WorkoutLogModel.find(
    { athleteId: { $in: challenge.participantIds }, status: "completed", date: range },
    { athleteId: 1, date: 1, completedAt: 1, stats: 1 },
  ).lean<LogForScore[]>();
  return { logs: logs.map(toScoreLog), entries: [] };
}

function score(
  challenge: StoredChallenge,
  today: string,
  data: { logs: ScoreLog[]; entries: ScoreEntry[] },
): ScoreResult {
  return computeStandings(
    {
      metric: challenge.metric,
      exerciseId: challenge.exerciseId?.toString() ?? null,
      manualMode: challenge.manualMode,
      dailyTarget: challenge.dailyTarget,
      scoring: challenge.scoring,
      goalValue: challenge.goalValue,
      startDate: challenge.startDate,
      lastDate: lastCountingDate(challenge, today),
      finished: challengeStatusOn(challenge, today) === "finished",
    },
    challenge.participantIds.map((id) => id.toString()),
    data.logs,
    data.entries,
  );
}

async function namesOf(ids: readonly Types.ObjectId[]) {
  const users = await UserModel.find({ _id: { $in: ids } }, { name: 1 }).lean<
    { _id: Types.ObjectId; name: string }[]
  >();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

async function buildDetail(
  challenge: StoredChallenge,
  perspective: Perspective,
): Promise<ChallengeDetail> {
  const today = todayIsoDate();
  const data = await loadScoreData(challenge, today);
  const result = score(challenge, today, data);
  const names = await namesOf([
    ...challenge.participantIds,
    ...(challenge.coachId ? [challenge.coachId] : []),
  ]);

  // Teilnehmer ohne Konto (gelöscht) fallen weg.
  const standings: ChallengeStanding[] = result.standings
    .filter((s) => names.has(s.athleteId))
    .map((s) => ({
      athleteId: s.athleteId,
      name: names.get(s.athleteId)!,
      score: s.score,
      rank: s.rank,
      achieved: s.achieved,
      isMe: s.athleteId === perspective.athleteId,
    }));
  const me = standings.find((s) => s.isMe) ?? null;

  let entries: ChallengeEntry[] = [];
  let todayValue: number | null = null;
  if (challenge.metric === "manual" && perspective.athleteId) {
    const own = data.entries
      .filter((e) => e.athleteId === perspective.athleteId)
      .sort((a, b) => a.date.localeCompare(b.date));
    todayValue = own.find((e) => e.date === today)?.value ?? null;
    if (perspective.withEntries) entries = own.map((e) => ({ date: e.date, value: e.value }));
  }

  return {
    id: challenge._id.toString(),
    kind: challenge.kind,
    metric: challenge.metric,
    scoring: challenge.scoring,
    title: challenge.title,
    description: challenge.description,
    exerciseId: challenge.exerciseId?.toString() ?? null,
    exerciseName: challenge.exerciseName,
    manualMode: challenge.manualMode,
    dailyTarget: challenge.dailyTarget,
    goalValue: challenge.goalValue,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    status: challengeStatusOn(challenge, today),
    endedEarly: challenge.endedEarly,
    today,
    prize: challenge.prize,
    ownerName: challenge.coachId ? (names.get(challenge.coachId.toString()) ?? null) : null,
    participantCount: standings.length,
    teamScore: result.teamScore,
    achievedCount: standings.filter((s) => s.achieved).length,
    leader: standings[0] ?? null,
    me,
    todayValue,
    standings,
    entries,
  };
}

function toSummary({ standings: _s, entries: _e, ...summary }: ChallengeDetail): ChallengeSummary {
  return summary;
}

/** Laufende zuerst, dann geplante, dann beendete (neueste zuerst). */
function sortForList(items: ChallengeSummary[]) {
  const order = { running: 0, planned: 1, finished: 2 } as const;
  return items.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.status === "finished"
        ? b.endDate.localeCompare(a.endDate)
        : a.endDate.localeCompare(b.endDate)),
  );
}

// ---------------------------------------------------------------------------------------------
// Coach

async function findOwnChallenge(coachId: string, id: string) {
  const challenge = await ChallengeModel.findOne({
    _id: id,
    kind: "coach",
    coachId,
  }).lean<StoredChallenge>();
  if (!challenge) throw new NotFoundError("Challenge nicht gefunden");
  return challenge;
}

/** Alle Teilnehmer müssen aktive oder eingeladene Athleten des Coaches sein. */
async function assertOwnAthletes(coachId: string, athleteIds: readonly string[]) {
  const count = await UserModel.countDocuments({
    _id: { $in: athleteIds },
    role: "athlete",
    coachId,
    status: { $ne: "disabled" },
  });
  if (count !== athleteIds.length) {
    throw new BadRequestError("Nicht alle Athleten gehören zu dir.", "invalid_participants");
  }
}

function assertNotInPast(startDate: string, today: string) {
  if (startDate < today) {
    throw new BadRequestError("Der Start darf nicht in der Vergangenheit liegen.", "start_in_past");
  }
}

function periodText(startDate: string, endDate: string) {
  return `vom ${formatDay(startDate)} bis ${formatDay(endDate)}`;
}

async function notifyParticipants(challenge: StoredChallenge, athleteIds: readonly string[]) {
  if (athleteIds.length === 0 || !challenge.coachId) return;
  const [coach, athletes] = await Promise.all([
    UserModel.findById(challenge.coachId, { name: 1 }).lean<{ name: string }>(),
    UserModel.find({ _id: { $in: athleteIds }, status: "active" }, { name: 1, email: 1 }).lean<
      { name: string; email: string }[]
    >(),
  ]);
  const url = `${env.APP_URL}/challenges/${challenge._id.toString()}`;
  await Promise.all(
    athletes.map((athlete) =>
      trySendMail(
        challengeAssignedMail({
          to: athlete.email,
          name: athlete.name,
          coachName: coach?.name ?? "Dein Coach",
          title: challenge.title,
          period: periodText(challenge.startDate, challenge.endDate),
          prize: challenge.prize,
          url,
        }),
      ),
    ),
  );
}

export async function createCoachChallenge(auth: AuthContext, input: CreateInput) {
  const today = todayIsoDate();
  assertNotInPast(input.startDate, today);
  await assertOwnAthletes(auth.userId, input.participantIds);
  const exercise = input.exerciseId ? await getExercise(auth, input.exerciseId) : null;

  const created = await ChallengeModel.create({
    kind: "coach",
    coachId: auth.userId,
    title: input.title,
    description: input.description,
    metric: input.metric,
    exerciseId: exercise?.id ?? null,
    exerciseName: exercise?.name ?? null,
    manualMode: input.manualMode,
    dailyTarget: input.manualMode === "quantity" ? input.dailyTarget : null,
    scoring: input.scoring,
    goalValue: input.goalValue,
    startDate: input.startDate,
    endDate: input.endDate,
    participantIds: input.participantIds,
    prize: input.prize,
  });
  const challenge = created.toObject<StoredChallenge>();
  await notifyParticipants(challenge, input.participantIds);
  return buildDetail(challenge, { athleteId: null, withEntries: false });
}

export async function listCoachChallenges(coachId: string): Promise<ChallengeListResponse> {
  const challenges = await ChallengeModel.find({ kind: "coach", coachId }).lean<
    StoredChallenge[]
  >();
  const details = await Promise.all(
    challenges.map((c) => buildDetail(c, { athleteId: null, withEntries: false })),
  );
  return { items: sortForList(details.map(toSummary)) };
}

export async function getCoachChallenge(coachId: string, id: string) {
  const challenge = await findOwnChallenge(coachId, id);
  return buildDetail(challenge, { athleteId: null, withEntries: false });
}

export async function updateCoachChallenge(auth: AuthContext, id: string, input: UpdateInput) {
  const challenge = await findOwnChallenge(auth.userId, id);
  const today = todayIsoDate();
  const status = challengeStatusOn(challenge, today);
  if (status === "finished") {
    throw new ConflictError("Die Challenge ist bereits beendet.", "challenge_finished");
  }
  const { title, description, prize, ...plannedOnly } = input;
  const touchesPlan = Object.values(plannedOnly).some((v) => v !== undefined);
  if (touchesPlan && status !== "planned") {
    throw new ConflictError(
      "Nach dem Start lassen sich nur Titel, Nachricht und Preis ändern.",
      "challenge_started",
    );
  }

  const next = {
    startDate: plannedOnly.startDate ?? challenge.startDate,
    endDate: plannedOnly.endDate ?? challenge.endDate,
    goalValue: plannedOnly.goalValue === undefined ? challenge.goalValue : plannedOnly.goalValue,
  };
  if (plannedOnly.startDate !== undefined) assertNotInPast(next.startDate, today);
  // Gleiche Regeln wie beim Anlegen, mit dem bisherigen Stand ergänzt.
  const check = createCoachChallengeRequestSchema.safeParse({
    title: title ?? challenge.title,
    metric: challenge.metric,
    exerciseId: challenge.exerciseId?.toString() ?? null,
    manualMode: challenge.manualMode,
    dailyTarget: challenge.dailyTarget,
    scoring: challenge.scoring,
    goalValue: next.goalValue,
    startDate: next.startDate,
    endDate: next.endDate,
    participantIds: plannedOnly.participantIds ?? challenge.participantIds.map(String),
  });
  if (!check.success) {
    const issue = check.error.issues[0]!;
    throw new BadRequestError(issue.message, "invalid_challenge");
  }

  const added: string[] = [];
  if (plannedOnly.participantIds) {
    await assertOwnAthletes(auth.userId, plannedOnly.participantIds);
    const before = new Set(challenge.participantIds.map(String));
    added.push(...plannedOnly.participantIds.filter((p) => !before.has(p)));
  }

  const updated = await ChallengeModel.findByIdAndUpdate(
    challenge._id,
    {
      $set: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(prize !== undefined && { prize }),
        ...next,
        ...(plannedOnly.participantIds && { participantIds: plannedOnly.participantIds }),
      },
    },
    { returnDocument: "after" },
  ).lean<StoredChallenge>();
  await notifyParticipants(updated!, added);
  return buildDetail(updated!, { athleteId: null, withEntries: false });
}

/** Beendet eine laufende Challenge heute. Geplante werden stattdessen gelöscht. */
export async function endCoachChallenge(coachId: string, id: string) {
  const challenge = await findOwnChallenge(coachId, id);
  const today = todayIsoDate();
  const status = challengeStatusOn(challenge, today);
  if (status === "planned") {
    throw new ConflictError(
      "Die Challenge hat noch nicht begonnen. Lösche sie stattdessen.",
      "challenge_not_started",
    );
  }
  if (status === "finished") {
    throw new ConflictError("Die Challenge ist bereits beendet.", "challenge_finished");
  }
  const updated = await ChallengeModel.findByIdAndUpdate(
    challenge._id,
    { $set: { endedEarly: true, endDate: today } },
    { returnDocument: "after" },
  ).lean<StoredChallenge>();
  return buildDetail(updated!, { athleteId: null, withEntries: false });
}

/** Nur vor dem Start, danach gehören die Ergebnisse den Athleten. */
export async function deleteCoachChallenge(coachId: string, id: string) {
  const challenge = await findOwnChallenge(coachId, id);
  if (challengeStatusOn(challenge, todayIsoDate()) !== "planned") {
    throw new ConflictError(
      "Gestartete Challenges lassen sich nicht löschen, nur beenden.",
      "challenge_started",
    );
  }
  await ChallengeModel.deleteOne({ _id: challenge._id });
}

/** Challenges eines Athleten aus Sicht seines Coaches (alle Arten, Stand des Athleten). */
export async function listAthleteChallenges(
  coachId: string,
  athleteId: string,
): Promise<ChallengeListResponse> {
  await getAthleteOfCoach(coachId, athleteId);
  return listFor(athleteId, { athleteId, withEntries: false });
}

// ---------------------------------------------------------------------------------------------
// Athlet

async function listFor(athleteId: string, perspective: Perspective) {
  const challenges = await ChallengeModel.find({
    participantIds: new Types.ObjectId(athleteId),
  }).lean<StoredChallenge[]>();
  const details = await Promise.all(challenges.map((c) => buildDetail(c, perspective)));
  return { items: sortForList(details.map(toSummary)) };
}

async function findParticipating(athleteId: string, id: string) {
  const challenge = await ChallengeModel.findOne({
    _id: id,
    participantIds: new Types.ObjectId(athleteId),
  }).lean<StoredChallenge>();
  if (!challenge) throw new NotFoundError("Challenge nicht gefunden");
  return challenge;
}

export function listMyChallenges(athleteId: string): Promise<ChallengeListResponse> {
  return listFor(athleteId, { athleteId, withEntries: true });
}

export async function getMyChallenge(athleteId: string, id: string) {
  const challenge = await findParticipating(athleteId, id);
  return buildDetail(challenge, { athleteId, withEntries: true });
}

/**
 * Tageswert einer freien Vorgabe. Nur für heute und nur, solange die Challenge läuft:
 * nachträgliches Eintragen würde die Rangliste beliebig verschieben.
 */
export async function setMyEntry(athleteId: string, id: string, date: string, value: number) {
  const challenge = await findParticipating(athleteId, id);
  if (challenge.metric !== "manual") {
    throw new ConflictError(
      "Diese Challenge wird automatisch aus deinen Trainings gewertet.",
      "challenge_not_manual",
    );
  }
  const today = todayIsoDate();
  if (challengeStatusOn(challenge, today) !== "running") {
    throw new ConflictError("Die Challenge läuft gerade nicht.", "challenge_not_running");
  }
  if (date !== today) {
    throw new ConflictError("Eintragen geht nur für heute.", "entry_not_today");
  }
  const stored = challenge.manualMode === "check" ? Math.min(1, value) : value;
  await ChallengeEntryModel.updateOne(
    { challengeId: challenge._id, athleteId, date },
    { $set: { value: stored } },
    { upsert: true },
  );
  return buildDetail(challenge, { athleteId, withEntries: true });
}

/**
 * Wirkung eines eben abgeschlossenen Trainings: Stand mit und ohne dieses Training in allen
 * laufenden Challenges, in denen es zählt. Dazu freie Vorgaben, für die heute noch nichts
 * eingetragen ist.
 */
export async function updatesAfterWorkout(
  athleteId: string,
  log: Pick<StoredWorkoutLog, "_id" | "date">,
): Promise<ChallengeWorkoutUpdate[]> {
  const today = todayIsoDate();
  const challenges = await ChallengeModel.find({
    participantIds: new Types.ObjectId(athleteId),
    startDate: { $lte: today },
    endDate: { $gte: today },
    endedEarly: false,
  }).lean<StoredChallenge[]>();

  const updates = await Promise.all(
    challenges.map(async (challenge): Promise<ChallengeWorkoutUpdate | null> => {
      const manual = challenge.metric === "manual";
      if (!manual && (log.date < challenge.startDate || log.date > challenge.endDate)) return null;
      const data = await loadScoreData(challenge, today);
      const after = score(challenge, today, data);
      const before = manual
        ? after
        : score(challenge, today, {
            logs: data.logs.filter((l) => l.id !== log._id.toString()),
            entries: [],
          });
      const mine = after.standings.find((s) => s.athleteId === athleteId);
      const previous = before.standings.find((s) => s.athleteId === athleteId);
      if (!mine || !previous) return null;
      const entryPending =
        manual && !data.entries.some((e) => e.athleteId === athleteId && e.date === today);
      const gained = Math.round((mine.score - previous.score) * 10) / 10;
      if (manual ? !entryPending : gained <= 0) return null;
      return {
        id: challenge._id.toString(),
        kind: challenge.kind,
        metric: challenge.metric,
        scoring: challenge.scoring,
        title: challenge.title,
        goalValue: challenge.goalValue,
        gained,
        score: mine.score,
        teamScore: after.teamScore,
        rank: mine.rank,
        previousRank: previous.rank,
        participantCount: after.standings.length,
        entryPending,
      };
    }),
  );
  return updates.filter((u) => u !== null);
}
