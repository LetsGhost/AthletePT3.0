import {
  addDays,
  DUEL_INVITE_DAYS,
  duelMetricLabels,
  MAX_OPEN_DUELS,
  todayIsoDate,
  type createDuelRequestSchema,
  type DuelMetric,
  type TeamDuelListResponse,
} from "@athletept/shared";
import { Types } from "mongoose";
import type { z } from "zod";

import { env } from "../../config/env";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors";
import { trySendMail } from "../../lib/mail/mailer";
import { duelInviteMail } from "../../lib/mail/templates";
import { ExerciseModel } from "../exercises/exercise.model";
import { notify } from "../notifications/notification.service";
import { UserModel } from "../users/user.model";
import { WorkoutLogModel } from "../workouts/workout-log.model";
import { involving } from "./challenge.service";
import {
  athletePerspective,
  buildDetail,
  coachPerspective,
  displayName,
  duelStateOf,
  isListed,
  sortForList,
  toSummary,
  usersOf,
} from "./challenge-view";
import { ChallengeModel, type StoredChallenge } from "./challenge.model";

type CreateInput = z.output<typeof createDuelRequestSchema>;

const validUntilFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

export function durationText(days: number) {
  return days === 7 ? "1 Woche" : `${days / 7} Wochen`;
}

/** Eingeladene, noch offene Duelle (eigene Einladungen) und laufende. */
async function openDuelCount(athleteId: string) {
  const today = todayIsoDate();
  const duels = await ChallengeModel.find({ kind: "duel", ...involving(athleteId) }).lean<
    StoredChallenge[]
  >();
  return duels.filter((duel) => {
    const state = duelStateOf(duel, today);
    if (state === "active") return true;
    return state === "pending" && duel.createdById?.toString() === athleteId;
  }).length;
}

async function assertDuelSlot(athleteId: string, message: string) {
  if ((await openDuelCount(athleteId)) >= MAX_OPEN_DUELS) {
    throw new ConflictError(message, "duel_limit");
  }
}

/**
 * Bei e1RM nur Übungen, die jeder kennen kann: aus dem globalen Katalog oder solche, die der
 * Herausforderer selbst schon trainiert hat. So lassen sich keine fremden Übungen erraten.
 */
async function findDuelExercise(athleteId: string, exerciseId: string) {
  const exercise = await ExerciseModel.findById(exerciseId, {
    name: 1,
    ownerCoachId: 1,
    ownerAthleteId: 1,
  }).lean<{ _id: Types.ObjectId; name: string; ownerCoachId: unknown; ownerAthleteId: unknown }>();
  const global = exercise && !exercise.ownerCoachId && !exercise.ownerAthleteId;
  const trained =
    exercise &&
    !global &&
    (await WorkoutLogModel.exists({ athleteId, "stats.exerciseId": exercise._id }));
  if (!exercise || (!global && !trained)) throw new NotFoundError("Übung nicht gefunden");
  return exercise;
}

interface NewDuel {
  metric: DuelMetric;
  exercise: { _id: Types.ObjectId; name: string } | null;
  durationDays: number;
  invitee: { _id: Types.ObjectId; email: string; name: string } | null;
  email: string;
  rematchOfId: Types.ObjectId | null;
}

async function createInvite(challengerId: string, duel: NewDuel) {
  const today = todayIsoDate();
  const expiresAt = new Date(Date.now() + DUEL_INVITE_DAYS * 24 * 60 * 60 * 1000);
  const created = await ChallengeModel.create({
    kind: "duel",
    title: duelMetricLabels[duel.metric],
    metric: duel.metric,
    exerciseId: duel.exercise?._id ?? null,
    exerciseName: duel.exercise?.name ?? null,
    scoring: "ranking",
    // Vorläufig: Der Zeitraum beginnt erst mit der Annahme.
    startDate: today,
    endDate: addDays(today, duel.durationDays - 1),
    participantIds: [challengerId],
    createdById: challengerId,
    invite: {
      athleteId: duel.invitee?._id ?? null,
      email: duel.email,
      status: "pending",
      expiresAt,
    },
    rematchOfId: duel.rematchOfId,
    durationDays: duel.durationDays,
  });
  const challenge = created.toObject<StoredChallenge>();

  if (duel.invitee) {
    const users = await usersOf([challengerId, duel.invitee._id]);
    const challenger = users.get(challengerId)!;
    const inviteeCoach = users.get(duel.invitee._id.toString())?.coachId ?? null;
    const challengerName = displayName(challengerId, challenger, {
      athleteId: duel.invitee._id.toString(),
      teamCoachId: inviteeCoach,
      withEntries: false,
    });
    const metricLabel = `${duelMetricLabels[duel.metric]}${duel.exercise ? ` · ${duel.exercise.name}` : ""}`;
    await notify([
      {
        userId: duel.invitee._id,
        kind: "duel_invite",
        title: `${challengerName} fordert dich zum Duell`,
        text: `${metricLabel} · ${durationText(duel.durationDays)}`,
        challengeId: challenge._id,
      },
    ]);
    await trySendMail(
      duelInviteMail({
        to: duel.invitee.email,
        name: duel.invitee.name,
        challengerName,
        metricLabel,
        duration: durationText(duel.durationDays),
        validUntil: validUntilFormat.format(expiresAt),
        url: `${env.APP_URL}/challenges/${challenge._id.toString()}`,
      }),
    );
  }
  return challenge;
}

/**
 * Fordert per E-Mail heraus. Die Antwort ist immer gleich, ob zur Adresse ein Athlet gehört oder
 * nicht: Ohne passenden Athleten verfällt die Einladung einfach. So verrät die API nicht, wer ein
 * Konto hat.
 */
export async function createDuel(athleteId: string, input: CreateInput) {
  const challenger = await UserModel.findById(athleteId, { email: 1 }).lean<{ email: string }>();
  if (challenger?.email === input.email) {
    throw new BadRequestError("Du kannst dich nicht selbst herausfordern.", "duel_self");
  }
  await assertDuelSlot(
    athleteId,
    `Du hast schon ${MAX_OPEN_DUELS} offene Duelle. Schließ eins ab oder warte, bis eine Einladung verfällt.`,
  );
  const exercise = input.exerciseId ? await findDuelExercise(athleteId, input.exerciseId) : null;
  const invitee = await UserModel.findOne(
    { email: input.email, role: "athlete", status: "active" },
    { email: 1, name: 1 },
  ).lean<{ _id: Types.ObjectId; email: string; name: string }>();

  const challenge = await createInvite(athleteId, {
    metric: input.metric,
    exercise,
    durationDays: input.durationDays,
    invitee,
    email: input.email,
    rematchOfId: null,
  });
  return buildDetail(challenge, await athletePerspective(athleteId));
}

async function findDuel(id: string, filter: Record<string, unknown>) {
  const duel = await ChallengeModel.findOne({
    _id: id,
    kind: "duel",
    ...filter,
  }).lean<StoredChallenge>();
  if (!duel) throw new NotFoundError("Duell nicht gefunden");
  return duel;
}

async function findInvitation(athleteId: string, id: string) {
  const duel = await findDuel(id, { "invite.athleteId": new Types.ObjectId(athleteId) });
  const state = duelStateOf(duel, todayIsoDate());
  if (state === "expired") {
    throw new ConflictError("Die Einladung ist abgelaufen.", "duel_expired");
  }
  if (state !== "pending") {
    throw new ConflictError("Auf diese Einladung hast du schon geantwortet.", "duel_not_pending");
  }
  return duel;
}

async function nameForChallenger(duel: StoredChallenge, athleteId: string) {
  const challengerId = duel.createdById!.toString();
  const users = await usersOf([challengerId, athleteId]);
  const me = users.get(athleteId);
  const challengerCoach = users.get(challengerId)?.coachId ?? null;
  return me
    ? displayName(athleteId, me, {
        athleteId: challengerId,
        teamCoachId: challengerCoach,
        withEntries: false,
      })
    : "Dein Gegner";
}

export async function acceptDuel(athleteId: string, id: string) {
  const duel = await findInvitation(athleteId, id);
  await assertDuelSlot(
    athleteId,
    `Du hast schon ${MAX_OPEN_DUELS} offene Duelle. Schließ erst eins ab.`,
  );
  const today = todayIsoDate();
  const updated = await ChallengeModel.findOneAndUpdate(
    { _id: duel._id, "invite.status": "pending" },
    {
      $set: {
        "invite.status": "accepted",
        "invite.respondedAt": new Date(),
        startDate: today,
        endDate: addDays(today, (duel.durationDays ?? 7) - 1),
      },
      $addToSet: { participantIds: new Types.ObjectId(athleteId) },
    },
    { returnDocument: "after" },
  ).lean<StoredChallenge>();
  if (!updated) {
    throw new ConflictError("Auf diese Einladung hast du schon geantwortet.", "duel_not_pending");
  }
  await notify([
    {
      userId: duel.createdById!,
      kind: "duel_accepted",
      title: `${await nameForChallenger(duel, athleteId)} hat dein Duell angenommen`,
      text: `${duel.title} · ${durationText(duel.durationDays ?? 7)} · los geht's`,
      challengeId: duel._id,
    },
  ]);
  return buildDetail(updated, await athletePerspective(athleteId));
}

export async function declineDuel(athleteId: string, id: string) {
  const duel = await findInvitation(athleteId, id);
  await ChallengeModel.updateOne(
    { _id: duel._id, "invite.status": "pending" },
    { $set: { "invite.status": "declined", "invite.respondedAt": new Date() } },
  );
  await notify([
    {
      userId: duel.createdById!,
      kind: "duel_declined",
      title: `${await nameForChallenger(duel, athleteId)} hat abgelehnt`,
      text: `${duel.title} · vielleicht beim nächsten Mal`,
      challengeId: duel._id,
    },
  ]);
}

/** Aufgeben: Der Gegner gewinnt sofort, gewertet ist bis heute. */
export async function giveUpDuel(athleteId: string, id: string) {
  const duel = await findDuel(id, { participantIds: new Types.ObjectId(athleteId) });
  const today = todayIsoDate();
  if (duelStateOf(duel, today) !== "active") {
    throw new ConflictError("Das Duell läuft gerade nicht.", "duel_not_active");
  }
  const updated = await ChallengeModel.findByIdAndUpdate(
    duel._id,
    {
      $set: {
        gaveUpById: athleteId,
        endedEarly: true,
        endDate: today,
        // Das Ergebnis ist mit dieser Benachrichtigung gemeldet.
        resultNotifiedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  ).lean<StoredChallenge>();
  const opponentId = duel.participantIds.map(String).find((p) => p !== athleteId);
  if (opponentId) {
    const users = await usersOf([athleteId, opponentId]);
    const me = users.get(athleteId);
    const name = me
      ? displayName(athleteId, me, {
          athleteId: opponentId,
          teamCoachId: users.get(opponentId)?.coachId ?? null,
          withEntries: false,
        })
      : "Dein Gegner";
    await notify([
      {
        userId: opponentId,
        kind: "duel_gave_up",
        title: `${name} hat aufgegeben`,
        text: `${duel.title} · du gewinnst das Duell`,
        challengeId: duel._id,
      },
    ]);
  }
  return buildDetail(updated!, await athletePerspective(athleteId));
}

/** Revanche: gleiche Wertung und Laufzeit, neue Einladung an denselben Gegner. */
export async function rematchDuel(athleteId: string, id: string) {
  const duel = await findDuel(id, { participantIds: new Types.ObjectId(athleteId) });
  const today = todayIsoDate();
  if (duelStateOf(duel, today) !== "finished") {
    throw new ConflictError("Eine Revanche geht erst nach dem Ende.", "duel_not_finished");
  }
  const opponentId = duel.participantIds.map(String).find((p) => p !== athleteId);
  const opponent = opponentId
    ? await UserModel.findOne(
        { _id: opponentId, role: "athlete", status: "active" },
        { email: 1, name: 1 },
      ).lean<{ _id: Types.ObjectId; email: string; name: string }>()
    : null;
  if (!opponent) {
    throw new ConflictError("Dein Gegner ist nicht mehr dabei.", "duel_opponent_gone");
  }
  await assertDuelSlot(
    athleteId,
    `Du hast schon ${MAX_OPEN_DUELS} offene Duelle. Schließ erst eins ab.`,
  );
  const challenge = await createInvite(athleteId, {
    metric: duel.metric as DuelMetric,
    exercise: duel.exerciseId ? { _id: duel.exerciseId, name: duel.exerciseName ?? "" } : null,
    durationDays: duel.durationDays ?? 7,
    invitee: opponent,
    email: opponent.email,
    rematchOfId: duel._id,
  });
  return buildDetail(challenge, await athletePerspective(athleteId));
}

/** Duelle der eigenen Athleten für den Coach, je Athlet aus dessen Sicht. */
export async function listTeamDuels(coachId: string): Promise<TeamDuelListResponse> {
  const today = todayIsoDate();
  const athletes = await UserModel.find({ role: "athlete", coachId }, { name: 1 }).lean<
    { _id: Types.ObjectId; name: string }[]
  >();
  const ids = athletes.map((a) => a._id);
  const duels = await ChallengeModel.find({
    kind: "duel",
    $or: [{ participantIds: { $in: ids } }, { "invite.athleteId": { $in: ids } }],
  }).lean<StoredChallenge[]>();

  const items = await Promise.all(
    duels
      .filter((duel) => isListed(duel, today))
      .flatMap((duel) =>
        athletes
          .filter(
            (a) =>
              duel.participantIds.some((p) => p.equals(a._id)) ||
              duel.invite?.athleteId?.equals(a._id),
          )
          .map(async (athlete) => ({
            athleteId: athlete._id.toString(),
            athleteName: athlete.name,
            challenge: toSummary(
              await buildDetail(duel, coachPerspective(coachId, athlete._id.toString())),
            ),
          })),
      ),
  );
  const order = sortForList(items.map((i) => i.challenge));
  return { items: items.sort((a, b) => order.indexOf(a.challenge) - order.indexOf(b.challenge)) };
}
