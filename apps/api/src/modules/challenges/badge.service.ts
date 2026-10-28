import {
  APP_TIME_ZONE,
  badgeTierLabels,
  isoWeekOf,
  shiftIsoWeek,
  tierFor,
  todayIsoDate,
  type Badge,
  type BadgeListResponse,
} from "@athletept/shared";
import { Types } from "mongoose";

import { getAthleteOfCoach } from "../athletes/athlete-access";
import { WorkoutLogModel, type StoredWorkoutLog } from "../workouts/workout-log.model";
import { loadScoreData, score, statusOf } from "./challenge-view";
import { ChallengeModel, type StoredChallenge } from "./challenge.model";

type LogForBadges = Pick<StoredWorkoutLog, "date" | "startedAt" | "stats">;

const hourFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: APP_TIME_ZONE,
});
const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Längste Folge von ISO-Wochen mit mindestens einem erledigten Training. */
export function longestWeekStreak(dates: readonly string[]) {
  const weeks = [...new Set(dates.map(isoWeekOf))].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const week of weeks) {
    run = previous && shiftIsoWeek(previous, 1) === week ? run + 1 : 1;
    best = Math.max(best, run);
    previous = week;
  }
  return best;
}

interface BadgeInput extends Omit<Badge, "tier" | "progress" | "thresholds"> {
  value: number;
  /** Bronze, Silber, Gold zum Vergleich mit `value`. */
  thresholds: number[];
  /** Beschriftung der Schwellen, z. B. „2 Wo.“ */
  labels: string[];
  /** Stand in Worten, z. B. „5 Wochen am Stück“. */
  valueText: string;
}

function badge({ value, thresholds, labels, valueText, ...rest }: BadgeInput): Badge {
  const tier = tierFor(value, thresholds);
  return {
    ...rest,
    thresholds: labels,
    tier,
    progress: tier ? `${badgeTierLabels[tier]} · ${valueText}` : `Noch offen · ${valueText}`,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function trainingBadges(logs: readonly LogForBadges[]): Badge[] {
  const weeks = longestWeekStreak(logs.map((l) => l.date));
  const perMonth = new Map<string, number>();
  for (const log of logs) {
    const month = log.date.slice(0, 7);
    perMonth.set(month, (perMonth.get(month) ?? 0) + 1);
  }
  const strongMonths = [...perMonth.values()].filter((count) => count >= 12).length;
  const early = logs.filter((l) => Number(hourFormat.format(l.startedAt)) < 8).length;
  const tonnage = Math.max(
    0,
    ...logs.map((l) => l.stats.reduce((sum, s) => sum + (s.volumeKg ?? 0), 0)),
  );
  const none = { challengeKind: null, challengeId: null } as const;
  return [
    badge({
      id: "streak",
      group: "series",
      name: "Serien-Starter",
      description: "Trainiere mehrere Wochen am Stück, jede Woche mindestens einmal.",
      icon: "flame",
      ...none,
      value: weeks,
      thresholds: [2, 4, 8],
      labels: ["2 Wo.", "4 Wo.", "8 Wo."],
      valueText: `${plural(weeks, "Woche", "Wochen")} am Stück`,
    }),
    badge({
      id: "monthly",
      group: "series",
      name: "Monats-Konstanz",
      description: "Monate mit mindestens 12 erledigten Trainings.",
      icon: "calendar",
      ...none,
      value: strongMonths,
      thresholds: [1, 3, 6],
      labels: ["1 Mon.", "3 Mon.", "6 Mon."],
      valueText: plural(strongMonths, "Monat", "Monate"),
    }),
    badge({
      id: "early",
      group: "series",
      name: "Frühaufsteher",
      description: "Trainings, die vor 8 Uhr morgens beginnen.",
      icon: "sunrise",
      ...none,
      value: early,
      thresholds: [5, 20, 50],
      labels: ["5", "20", "50"],
      valueText: plural(early, "Training", "Trainings"),
    }),
    badge({
      id: "tonnage",
      group: "records",
      name: "Tonnage",
      description: "Bewege viel Gewicht in einem einzigen Training.",
      icon: "volume",
      ...none,
      value: tonnage,
      thresholds: [5000, 10_000, 15_000],
      labels: ["5 t", "10 t", "15 t"],
      valueText: `bestes Training ${numberFormat.format(tonnage / 1000)} t`,
    }),
  ];
}

/** System-Runde: Stufen aus der Vorlage, bei Volumen in Tonnen beschriftet. */
function systemBadge(
  challenge: StoredChallenge,
  scoreValue: number,
  rank: number,
  finished: boolean,
) {
  const tiers = challenge.tiers!;
  const tons = challenge.metric === "volume";
  const show = (v: number) => `${numberFormat.format(tons ? v / 1000 : v)}${tons ? " t" : ""}`;
  return badge({
    id: `system:${challenge._id.toString()}`,
    group: "challenges",
    name: challenge.title,
    description: finished ? "System-Challenge, beendet." : "System-Challenge, läuft noch.",
    icon: "system",
    challengeKind: "system",
    challengeId: challenge._id.toString(),
    value: scoreValue,
    thresholds: tiers,
    labels: tiers.map(show),
    valueText: `${show(scoreValue)} · Platz ${rank}`,
  });
}

async function challengeBadges(athleteId: string): Promise<Badge[]> {
  const today = todayIsoDate();
  const challenges = await ChallengeModel.find({
    participantIds: new Types.ObjectId(athleteId),
  }).lean<StoredChallenge[]>();
  const results = await Promise.all(
    challenges
      .filter((c) => statusOf(c, today) !== "planned")
      .map(async (challenge) => {
        const { standings } = score(challenge, today, await loadScoreData(challenge, today));
        const mine = standings.find((s) => s.athleteId === athleteId);
        return { challenge, mine, finished: statusOf(challenge, today) === "finished" };
      }),
  );

  const wins = (kind: StoredChallenge["kind"]) =>
    results.filter((r) => r.challenge.kind === kind && r.finished && r.mine?.achieved).length;
  const duelWins = wins("duel");
  const coachWins = wins("coach");

  const system = results
    .filter((r) => r.challenge.kind === "system" && r.challenge.tiers?.length && r.mine)
    .sort((a, b) => b.challenge.startDate.localeCompare(a.challenge.startDate))
    .map((r) => systemBadge(r.challenge, r.mine!.score, r.mine!.rank, r.finished));

  return [
    ...system,
    badge({
      id: "duelist",
      group: "challenges",
      name: "Duellant",
      description: "Gewinne Duelle gegen andere Athleten.",
      icon: "duel",
      challengeKind: "duel",
      challengeId: null,
      value: duelWins,
      thresholds: [1, 5, 15],
      labels: ["1", "5", "15"],
      valueText: plural(duelWins, "Sieg", "Siege"),
    }),
    badge({
      id: "team",
      group: "challenges",
      name: "Team-Player",
      description: "Coach-Challenges geschafft oder gewonnen.",
      icon: "coach",
      challengeKind: "coach",
      challengeId: null,
      value: coachWins,
      thresholds: [1, 3, 10],
      labels: ["1", "3", "10"],
      valueText: `${coachWins} geschafft`,
    }),
  ];
}

async function badgesOf(athleteId: string): Promise<BadgeListResponse> {
  const logs = await WorkoutLogModel.find(
    { athleteId, status: "completed" },
    { date: 1, startedAt: 1, stats: 1 },
  ).lean<LogForBadges[]>();
  const items = [...trainingBadges(logs), ...(await challengeBadges(athleteId))];
  return { items, earnedCount: items.filter((b) => b.tier !== null).length };
}

export function listMyBadges(athleteId: string) {
  return badgesOf(athleteId);
}

export async function listAthleteBadges(coachId: string, athleteId: string) {
  await getAthleteOfCoach(coachId, athleteId);
  return badgesOf(athleteId);
}
