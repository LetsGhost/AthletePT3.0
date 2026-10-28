import { badgeTierLabels, tierFor, todayIsoDate } from "@athletept/shared";
import type { Types } from "mongoose";

import { env } from "../../config/env";
import { logger } from "../../lib/logger/logger";
import { trySendMail } from "../../lib/mail/mailer";
import { challengeFinishedMail } from "../../lib/mail/templates";
import { notify, type NewNotification } from "../notifications/notification.service";
import { UserModel } from "../users/user.model";
import { displayName, duelStateOf, loadScoreData, score, usersOf } from "./challenge-view";
import { ChallengeModel, type StoredChallenge } from "./challenge.model";
import { ensureSystemRounds } from "./system.service";

const INTERVAL_MS = 60 * 60 * 1000;
const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Einladungen, deren Frist abgelaufen ist: verfallen lassen und den Herausforderer informieren. */
async function expireInvites(now: Date) {
  const duels = await ChallengeModel.find({
    kind: "duel",
    "invite.status": "pending",
    "invite.expiresAt": { $lte: now },
  }).lean<StoredChallenge[]>();
  for (const duel of duels) {
    const result = await ChallengeModel.updateOne(
      { _id: duel._id, "invite.status": "pending" },
      { $set: { "invite.status": "expired" } },
    );
    if (result.modifiedCount === 0 || !duel.createdById) continue;
    // Nur die Adresse, die der Herausforderer selbst eingegeben hat: verrät kein Konto.
    await notify([
      {
        userId: duel.createdById,
        kind: "duel_expired",
        title: "Einladung verfallen",
        text: `${duel.title} · ${duel.invite!.email} hat nicht reagiert`,
        challengeId: duel._id,
      },
    ]);
  }
  return duels.length;
}

interface Outcome {
  title: string;
  text: string;
}

function outcomeFor(
  challenge: StoredChallenge,
  standing: { athleteId: string; score: number; rank: number; achieved: boolean | null },
  total: number,
  opponent: { name: string; score: number } | null,
): Outcome {
  const won = standing.achieved === true;
  if (challenge.kind === "duel" && opponent) {
    const result = `${numberFormat.format(standing.score)} : ${numberFormat.format(opponent.score)}`;
    return won
      ? { title: `Duell gegen ${opponent.name} gewonnen`, text: `${challenge.title} · ${result}` }
      : { title: `Duell gegen ${opponent.name} beendet`, text: `${challenge.title} · ${result}` };
  }
  if (challenge.tiers?.length) {
    const tier = tierFor(standing.score, challenge.tiers);
    return {
      title: tier
        ? `${challenge.title}: ${badgeTierLabels[tier]}`
        : `${challenge.title} ist beendet`,
      text: `Platz ${standing.rank} von ${total}`,
    };
  }
  if (challenge.scoring === "ranking") {
    return won
      ? { title: `${challenge.title}: gewonnen!`, text: `Platz 1 von ${total}` }
      : { title: `${challenge.title} ist beendet`, text: `Platz ${standing.rank} von ${total}` };
  }
  const goal = challenge.scoring === "team_goal" ? "Team-Ziel" : "Ziel";
  return won
    ? { title: `${challenge.title}: ${goal} erreicht`, text: "Stark durchgezogen" }
    : { title: `${challenge.title} ist beendet`, text: `${goal} knapp verfehlt` };
}

/** Beendete Challenges: Ergebnis einmal je Teilnehmer melden (App und Mail). */
async function reportResults(now: Date) {
  const today = todayIsoDate(now);
  const challenges = await ChallengeModel.find({
    resultNotifiedAt: null,
    $or: [{ endDate: { $lt: today } }, { endedEarly: true }],
  }).lean<StoredChallenge[]>();

  for (const challenge of challenges) {
    const claimed = await ChallengeModel.updateOne(
      { _id: challenge._id, resultNotifiedAt: null },
      { $set: { resultNotifiedAt: now } },
    );
    if (claimed.modifiedCount === 0) continue;
    // Abgelehnte und verfallene Duelle haben kein Ergebnis.
    const duel = duelStateOf(challenge, today, now);
    if (duel !== null && duel !== "finished") continue;

    const { standings } = score(challenge, today, await loadScoreData(challenge, today));
    const users = await usersOf(standings.map((s) => s.athleteId));
    const notifications: NewNotification[] = [];
    const mails: Parameters<typeof challengeFinishedMail>[0][] = [];
    const accounts = await UserModel.find(
      {
        _id: { $in: standings.map((s) => s.athleteId) },
        status: "active",
        challengeMails: { $ne: false },
      },
      { email: 1, name: 1 },
    ).lean<{ _id: Types.ObjectId; email: string; name: string }[]>();
    const emails = new Map(accounts.map((a) => [a._id.toString(), a]));

    for (const standing of standings) {
      const user = users.get(standing.athleteId);
      if (!user) continue;
      const other = standings.find((s) => s.athleteId !== standing.athleteId);
      const otherUser = other ? users.get(other.athleteId) : undefined;
      const opponent =
        other && otherUser
          ? {
              name: displayName(other.athleteId, otherUser, {
                athleteId: standing.athleteId,
                teamCoachId: user.coachId,
                withEntries: false,
              }),
              score: other.score,
            }
          : null;
      const outcome = outcomeFor(challenge, standing, standings.length, opponent);
      notifications.push({
        userId: standing.athleteId,
        kind: "challenge_finished",
        title: outcome.title,
        text: outcome.text,
        challengeId: challenge._id,
      });
      const account = emails.get(standing.athleteId);
      if (account) {
        mails.push({
          to: account.email,
          name: account.name,
          title: challenge.title,
          result: `${outcome.title}. ${outcome.text}.`,
          url: `${env.APP_URL}/challenges/${challenge._id.toString()}`,
        });
      }
    }
    await notify(notifications);
    await Promise.all(mails.map((mail) => trySendMail(challengeFinishedMail(mail))));
  }
}

/** Ein Durchlauf. Idempotent, jede Meldung geht höchstens einmal raus. */
export async function runChallengeJob(now = new Date()) {
  await ensureSystemRounds(todayIsoDate(now));
  const expired = await expireInvites(now);
  await reportResults(now);
  return { expired };
}

/** Beim Start und danach stündlich. Reicht für eine einzelne API-Instanz. */
export function startChallengeJob() {
  const run = async () => {
    try {
      await runChallengeJob();
    } catch (error) {
      logger.error("Challenge-Job fehlgeschlagen", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  void run();
  setInterval(() => void run(), INTERVAL_MS).unref();
}
