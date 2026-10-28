import {
  createCoachChallengeRequestSchema,
  todayIsoDate,
  type ChallengeListResponse,
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
import { notify, type NewNotification } from "../notifications/notification.service";
import { UserModel } from "../users/user.model";
import type { StoredWorkoutLog } from "../workouts/workout-log.model";
import {
  athletePerspective,
  buildDetail,
  coachPerspective,
  displayName,
  isListed,
  loadScoreData,
  score,
  sortForList,
  statusOf,
  toSummary,
  usersOf,
  type Perspective,
} from "./challenge-view";
import { ChallengeEntryModel, ChallengeModel, type StoredChallenge } from "./challenge.model";

type CreateInput = z.output<typeof createCoachChallengeRequestSchema>;
type UpdateInput = z.output<typeof updateCoachChallengeRequestSchema>;

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export const formatDay = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

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
  await notify(
    athleteIds.map((userId) => ({
      userId,
      kind: "challenge_started" as const,
      title: `Neue Challenge: ${challenge.title}`,
      text: `${formatDay(challenge.startDate)} bis ${formatDay(challenge.endDate)}${challenge.prize ? ` · Preis: ${challenge.prize}` : ""}`,
      challengeId: challenge._id,
    })),
  );
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
  return buildDetail(challenge, coachPerspective(auth.userId));
}

export async function listCoachChallenges(coachId: string): Promise<ChallengeListResponse> {
  const challenges = await ChallengeModel.find({ kind: "coach", coachId }).lean<
    StoredChallenge[]
  >();
  const details = await Promise.all(
    challenges.map((c) => buildDetail(c, coachPerspective(coachId))),
  );
  return { items: sortForList(details.map(toSummary)) };
}

export async function getCoachChallenge(coachId: string, id: string) {
  const challenge = await findOwnChallenge(coachId, id);
  return buildDetail(challenge, coachPerspective(coachId));
}

export async function updateCoachChallenge(auth: AuthContext, id: string, input: UpdateInput) {
  const challenge = await findOwnChallenge(auth.userId, id);
  const today = todayIsoDate();
  const status = statusOf(challenge, today);
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
  return buildDetail(updated!, coachPerspective(auth.userId));
}

/** Beendet eine laufende Challenge heute. Geplante werden stattdessen gelöscht. */
export async function endCoachChallenge(coachId: string, id: string) {
  const challenge = await findOwnChallenge(coachId, id);
  const today = todayIsoDate();
  const status = statusOf(challenge, today);
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
  return buildDetail(updated!, coachPerspective(coachId));
}

/** Nur vor dem Start, danach gehören die Ergebnisse den Athleten. */
export async function deleteCoachChallenge(coachId: string, id: string) {
  const challenge = await findOwnChallenge(coachId, id);
  if (statusOf(challenge, todayIsoDate()) !== "planned") {
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
  return listFor(athleteId, coachPerspective(coachId, athleteId));
}

// ---------------------------------------------------------------------------------------------
// Athlet

/** Teilnehmer oder zu einem Duell eingeladen. */
export const involving = (athleteId: string) => {
  const id = new Types.ObjectId(athleteId);
  return { $or: [{ participantIds: id }, { "invite.athleteId": id }] };
};

export async function listFor(
  athleteId: string,
  perspective: Perspective,
): Promise<ChallengeListResponse> {
  const today = todayIsoDate();
  const challenges = await ChallengeModel.find(involving(athleteId)).lean<StoredChallenge[]>();
  const details = await Promise.all(
    challenges.filter((c) => isListed(c, today)).map((c) => buildDetail(c, perspective)),
  );
  return { items: sortForList(details.map(toSummary)) };
}

export async function findInvolving(athleteId: string, id: string) {
  const challenge = await ChallengeModel.findOne({
    _id: id,
    ...involving(athleteId),
  }).lean<StoredChallenge>();
  if (!challenge) throw new NotFoundError("Challenge nicht gefunden");
  return challenge;
}

export async function listMyChallenges(athleteId: string): Promise<ChallengeListResponse> {
  return listFor(athleteId, await athletePerspective(athleteId));
}

export async function getMyChallenge(athleteId: string, id: string) {
  const challenge = await findInvolving(athleteId, id);
  return buildDetail(challenge, await athletePerspective(athleteId));
}

/**
 * Tageswert einer freien Vorgabe. Nur für heute und nur, solange die Challenge läuft:
 * nachträgliches Eintragen würde die Rangliste beliebig verschieben.
 */
export async function setMyEntry(athleteId: string, id: string, date: string, value: number) {
  const challenge = await findInvolving(athleteId, id);
  if (challenge.metric !== "manual") {
    throw new ConflictError(
      "Diese Challenge wird automatisch aus deinen Trainings gewertet.",
      "challenge_not_manual",
    );
  }
  const today = todayIsoDate();
  if (statusOf(challenge, today) !== "running") {
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
  return buildDetail(challenge, await athletePerspective(athleteId));
}

/**
 * Wirkung eines eben abgeschlossenen Trainings: Stand mit und ohne dieses Training in allen
 * laufenden Challenges, in denen es zählt. Dazu freie Vorgaben, für die heute noch nichts
 * eingetragen ist. Wer in einer Rangliste überholt wurde, bekommt eine Benachrichtigung.
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
  const overtaken: { challenge: StoredChallenge; athleteIds: string[] }[] = [];

  const updates = await Promise.all(
    challenges.map(async (challenge): Promise<ChallengeWorkoutUpdate | null> => {
      if (statusOf(challenge, today) !== "running") return null;
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

      if (challenge.scoring === "ranking" && mine.rank < previous.rank) {
        const passed = before.standings.filter(
          (s) =>
            s.athleteId !== athleteId &&
            s.score > 0 &&
            s.rank <= previous.rank &&
            after.standings.find((a) => a.athleteId === s.athleteId)!.rank > mine.rank,
        );
        if (passed.length > 0) {
          overtaken.push({ challenge, athleteIds: passed.map((p) => p.athleteId) });
        }
      }

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
  await notifyOvertaken(athleteId, overtaken);
  return updates.filter((u) => u !== null);
}

async function notifyOvertaken(
  athleteId: string,
  overtaken: readonly { challenge: StoredChallenge; athleteIds: string[] }[],
) {
  if (overtaken.length === 0) return;
  const users = await usersOf([athleteId, ...overtaken.flatMap((o) => o.athleteIds)]);
  const me = users.get(athleteId);
  if (!me) return;
  const notifications: NewNotification[] = overtaken.flatMap(({ challenge, athleteIds }) =>
    athleteIds.flatMap((id) => {
      const recipient = users.get(id);
      if (!recipient) return [];
      // Name so, wie ihn der Überholte sehen darf.
      const name = displayName(athleteId, me, {
        athleteId: id,
        teamCoachId: recipient.coachId,
        withEntries: false,
      });
      return [
        {
          userId: id,
          kind: "challenge_overtaken" as const,
          title: `${name} hat dich überholt`,
          text: challenge.title,
          challengeId: challenge._id,
        },
      ];
    }),
  );
  await notify(notifications);
}
