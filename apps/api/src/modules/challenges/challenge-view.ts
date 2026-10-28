import {
  challengeStatusOn,
  todayIsoDate,
  type ChallengeDetail,
  type ChallengeEntry,
  type ChallengeStanding,
  type ChallengeStatus,
  type ChallengeSummary,
  type DuelInfo,
  type DuelState,
} from "@athletept/shared";
import type { Types } from "mongoose";

import { UserModel } from "../users/user.model";
import { WorkoutLogModel, type StoredWorkoutLog } from "../workouts/workout-log.model";
import {
  computeDailyValues,
  computeStandings,
  type ScoreDefinition,
  type ScoreEntry,
  type ScoreLog,
  type ScoreResult,
} from "./challenge-score";
import {
  ChallengeEntryModel,
  type StoredChallenge,
  type StoredChallengeEntry,
} from "./challenge.model";

/**
 * Aus wessen Sicht eine Challenge gezeigt wird. Echte Namen sieht nur, wer im selben Team ist
 * (gleicher Coach), alle anderen erscheinen gekürzt („Lena B.“).
 */
export interface Perspective {
  /** Athlet, dessen Stand `me` ist (der Athlet selbst oder für seinen Coach). */
  athleteId: string | null;
  /** Coach des Teams, dessen Namen voll erscheinen. */
  teamCoachId: string | null;
  /** Eigene Einträge nur für den Athleten selbst. */
  withEntries: boolean;
}

export const coachPerspective = (
  coachId: string,
  athleteId: string | null = null,
): Perspective => ({
  athleteId,
  teamCoachId: coachId,
  withEntries: false,
});

export async function athletePerspective(athleteId: string): Promise<Perspective> {
  const athlete = await UserModel.findById(athleteId, { coachId: 1 }).lean<{
    coachId: Types.ObjectId | null;
  }>();
  return {
    athleteId,
    teamCoachId: athlete?.coachId?.toString() ?? null,
    withEntries: true,
  };
}

/** Letzter Tag, der zählt: das Ende oder heute, was früher ist. */
export function lastCountingDate(challenge: StoredChallenge, today: string) {
  return challenge.endDate < today ? challenge.endDate : today;
}

/** Zustand eines Duells, `null` bei anderen Challenges. Abgelaufene Einladungen zählen sofort. */
export function duelStateOf(
  challenge: StoredChallenge,
  today: string,
  now = new Date(),
): DuelState | null {
  const invite = challenge.invite;
  if (challenge.kind !== "duel" || !invite) return null;
  if (invite.status === "declined") return "declined";
  if (invite.status === "expired") return "expired";
  if (invite.status === "pending") return invite.expiresAt <= now ? "expired" : "pending";
  return challengeStatusOn(challenge, today) === "finished" ? "finished" : "active";
}

export function statusOf(
  challenge: StoredChallenge,
  today: string,
  now = new Date(),
): ChallengeStatus {
  const duel = duelStateOf(challenge, today, now);
  if (duel === "pending") return "planned";
  if (duel === "declined" || duel === "expired") return "finished";
  return challengeStatusOn(challenge, today);
}

/** Abgelehnte und verfallene Duelle tauchen in keiner Liste auf, nur in Benachrichtigungen. */
export function isListed(challenge: StoredChallenge, today: string) {
  const duel = duelStateOf(challenge, today);
  return duel !== "declined" && duel !== "expired";
}

/** Gewertet wird erst, wenn ein Duell angenommen ist. */
function isScored(challenge: StoredChallenge, today: string) {
  const duel = duelStateOf(challenge, today);
  return duel === null || duel === "active" || duel === "finished";
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

export interface ScoreData {
  logs: ScoreLog[];
  entries: ScoreEntry[];
}

/** Trainings bzw. Einträge, aus denen sich der Stand einer Challenge ergibt. */
export async function loadScoreData(challenge: StoredChallenge, today: string): Promise<ScoreData> {
  const lastDate = lastCountingDate(challenge, today);
  if (
    lastDate < challenge.startDate ||
    challenge.participantIds.length === 0 ||
    !isScored(challenge, today)
  ) {
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

function definitionOf(challenge: StoredChallenge, today: string): ScoreDefinition {
  return {
    metric: challenge.metric,
    exerciseId: challenge.exerciseId?.toString() ?? null,
    manualMode: challenge.manualMode,
    dailyTarget: challenge.dailyTarget,
    scoring: challenge.scoring,
    goalValue: challenge.goalValue,
    startDate: challenge.startDate,
    lastDate: lastCountingDate(challenge, today),
    finished: statusOf(challenge, today) === "finished",
  };
}

/**
 * Stand aller Teilnehmer. Wer im Duell aufgegeben hat, landet hinter dem Gegner, egal mit
 * welchem Wert.
 */
export function score(challenge: StoredChallenge, today: string, data: ScoreData): ScoreResult {
  const result = computeStandings(
    definitionOf(challenge, today),
    challenge.participantIds.map((id) => id.toString()),
    data.logs,
    data.entries,
  );
  const quitter = challenge.gaveUpById?.toString();
  if (!quitter) return result;
  const standings = [
    ...result.standings.filter((s) => s.athleteId !== quitter),
    ...result.standings.filter((s) => s.athleteId === quitter),
  ].map((s, index) => ({ ...s, rank: index + 1, achieved: s.athleteId !== quitter }));
  return { ...result, standings };
}

interface UserInfo {
  name: string;
  coachId: string | null;
}

export async function usersOf(ids: readonly (Types.ObjectId | string)[]) {
  const users = await UserModel.find({ _id: { $in: ids } }, { name: 1, coachId: 1 }).lean<
    { _id: Types.ObjectId; name: string; coachId: Types.ObjectId | null }[]
  >();
  return new Map<string, UserInfo>(
    users.map((u) => [u._id.toString(), { name: u.name, coachId: u.coachId?.toString() ?? null }]),
  );
}

/** „Lena Beispiel“ → „Lena B.“ */
export function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : (first ?? name);
}

/** Voller Name im eigenen Team und für sich selbst, sonst gekürzt. */
export function displayName(id: string, user: UserInfo, perspective: Perspective) {
  const sameTeam =
    id === perspective.athleteId ||
    id === perspective.teamCoachId ||
    (perspective.teamCoachId !== null && user.coachId === perspective.teamCoachId);
  return sameTeam ? user.name : shortName(user.name);
}

function duelInfo(
  challenge: StoredChallenge,
  state: DuelState,
  users: Map<string, UserInfo>,
  perspective: Perspective,
): DuelInfo {
  const invite = challenge.invite!;
  const challengerId = challenge.createdById?.toString() ?? null;
  const inviteeId = invite.athleteId?.toString() ?? null;
  const viewer = perspective.athleteId;
  const iAmChallenger = viewer === null ? null : viewer === challengerId;
  // Der Herausforderer erfährt erst mit der Annahme, wem die Adresse gehört (bei einer Revanche
  // kennt er den Gegner schon).
  const inviteeKnown = invite.status === "accepted" || Boolean(challenge.rematchOfId);
  const opponentId = viewer === challengerId ? (inviteeKnown ? inviteeId : null) : challengerId;
  const nameOf = (id: string | null) => {
    const user = id ? users.get(id) : undefined;
    return id && user ? displayName(id, user, perspective) : null;
  };
  return {
    state,
    iAmChallenger,
    durationDays: challenge.durationDays ?? 0,
    expiresAt: invite.expiresAt.toISOString(),
    invitedEmail: iAmChallenger && !inviteeKnown ? invite.email : null,
    opponentName: nameOf(opponentId),
    gaveUpName: nameOf(challenge.gaveUpById?.toString() ?? null),
  };
}

export async function buildDetail(
  challenge: StoredChallenge,
  perspective: Perspective,
): Promise<ChallengeDetail> {
  const today = todayIsoDate();
  const data = await loadScoreData(challenge, today);
  const result = score(challenge, today, data);
  const users = await usersOf([
    ...challenge.participantIds,
    ...(challenge.coachId ? [challenge.coachId] : []),
    ...(challenge.createdById ? [challenge.createdById] : []),
    ...(challenge.invite?.athleteId ? [challenge.invite.athleteId] : []),
  ]);

  // Teilnehmer ohne Konto (gelöscht) fallen weg.
  const standings: ChallengeStanding[] = result.standings
    .filter((s) => users.has(s.athleteId))
    .map((s) => ({
      athleteId: s.athleteId,
      name: displayName(s.athleteId, users.get(s.athleteId)!, perspective),
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

  const state = duelStateOf(challenge, today);
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
    status: statusOf(challenge, today),
    endedEarly: challenge.endedEarly,
    today,
    prize: challenge.prize,
    ownerName: challenge.coachId ? (users.get(challenge.coachId.toString())?.name ?? null) : null,
    participantCount: standings.length,
    teamScore: result.teamScore,
    achievedCount: standings.filter((s) => s.achieved).length,
    leader: standings[0] ?? null,
    me,
    todayValue,
    duel: state ? duelInfo(challenge, state, users, perspective) : null,
    standings,
    entries,
    daily:
      challenge.kind === "duel"
        ? computeDailyValues(definitionOf(challenge, today), data.logs)
        : [],
  };
}

export function toSummary({
  standings: _s,
  entries: _e,
  daily: _d,
  ...summary
}: ChallengeDetail): ChallengeSummary {
  return summary;
}

/** Laufende zuerst, dann geplante, dann beendete (neueste zuerst). */
export function sortForList(items: ChallengeSummary[]) {
  const order = { running: 0, planned: 1, finished: 2 } as const;
  return items.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.status === "finished"
        ? b.endDate.localeCompare(a.endDate)
        : a.endDate.localeCompare(b.endDate)),
  );
}
