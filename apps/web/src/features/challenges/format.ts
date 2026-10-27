import {
  daysInPeriod,
  type ChallengeMetric,
  type ChallengeSummary,
  type ChallengeWorkoutUpdate,
} from "@athletept/shared";

import { formatNumber, parseIsoDate } from "@/lib/format";

const shortDate = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
const dayOnly = new Intl.DateTimeFormat("de-DE", { day: "numeric" });

/** „1.–31. Okt.“ bzw. „28. Sep. – 4. Okt.“ */
export function formatPeriod(startDate: string, endDate: string) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (startDate === endDate) return shortDate.format(start);
  if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
    return `${dayOnly.format(start)}.–${shortDate.format(end)}`;
  }
  return `${shortDate.format(start)} – ${shortDate.format(end)}`;
}

/** „noch 4 Tage“, „letzter Tag“, „startet in 5 Tagen“, „beendet am 31. Okt.“ */
export function formatCountdown(
  challenge: Pick<ChallengeSummary, "status" | "startDate" | "endDate" | "today">,
) {
  if (challenge.status === "planned") {
    const days = daysInPeriod(challenge.today, challenge.startDate) - 1;
    return days === 1 ? "startet morgen" : `startet in ${days} Tagen`;
  }
  if (challenge.status === "finished") {
    return `beendet am ${shortDate.format(parseIsoDate(challenge.endDate))}`;
  }
  const left = daysInPeriod(challenge.today, challenge.endDate) - 1;
  if (left === 0) return "letzter Tag";
  return left === 1 ? "noch 1 Tag" : `noch ${left} Tage`;
}

/** Einheit des Werts, Einzahl und Mehrzahl. */
const units: Record<Exclude<ChallengeMetric, "volume" | "e1rm">, [string, string]> = {
  workouts: ["Training", "Trainings"],
  training_days: ["Trainingstag", "Trainingstage"],
  sets: ["Satz", "Sätze"],
  manual: ["Tag", "Tage"],
};

/** „14 Trainings“, „31,4 t“, „850 kg“, „120 kg“ (e1RM), „4 Tage“. */
export function formatScore(metric: ChallengeMetric, value: number) {
  if (metric === "volume") {
    return value >= 1000 ? `${formatNumber(value / 1000)} t` : `${formatNumber(value)} kg`;
  }
  if (metric === "e1rm") return `${formatNumber(value)} kg`;
  const [one, many] = units[metric];
  return `${formatNumber(value)} ${value === 1 ? one : many}`;
}

/** Wert ohne Einheit für große Anzeigen, dazu die Einheit getrennt. */
export function scoreParts(metric: ChallengeMetric, value: number) {
  if (metric === "volume" && value >= 1000) {
    return { value: formatNumber(value / 1000), unit: "Tonnen" };
  }
  if (metric === "volume" || metric === "e1rm") return { value: formatNumber(value), unit: "kg" };
  const [one, many] = units[metric];
  return { value: formatNumber(value), unit: value === 1 ? one : many };
}

/** Anteil am Ziel bzw. am Führenden, 0 bis 1. */
export function progressRatio(
  challenge: Pick<ChallengeSummary, "scoring" | "goalValue" | "teamScore" | "leader" | "me">,
) {
  const score = challenge.me?.score ?? 0;
  if (challenge.scoring === "team_goal" && challenge.goalValue) {
    return Math.min(1, challenge.teamScore / challenge.goalValue);
  }
  if (challenge.scoring === "goal" && challenge.goalValue) {
    return Math.min(1, score / challenge.goalValue);
  }
  const leader = challenge.leader?.score ?? 0;
  return leader > 0 ? Math.min(1, score / leader) : 0;
}

/** Kurzer Stand: „Platz 2 von 6“, „Ziel erreicht“, „Team: 82 %“. */
export function standingText(challenge: ChallengeSummary) {
  const me = challenge.me;
  if (challenge.scoring === "team_goal" && challenge.goalValue) {
    const percent = Math.round((challenge.teamScore / challenge.goalValue) * 100);
    return `Team-Ziel ${Math.min(percent, 100)} %`;
  }
  if (!me) return `${challenge.participantCount} dabei`;
  if (challenge.scoring === "goal") {
    if (me.achieved) return "Ziel erreicht";
    if (me.achieved === false) return "Ziel verfehlt";
    return `${formatScore(challenge.metric, me.score)} von ${formatScore(challenge.metric, challenge.goalValue ?? 0)}`;
  }
  return `Platz ${me.rank} von ${challenge.participantCount}`;
}

/** Was eine Challenge misst, z. B. „Bewegte kg · Kniebeuge“ oder „Tagesziel 100“. */
export function measureText(
  challenge: Pick<ChallengeSummary, "metric" | "exerciseName" | "manualMode" | "dailyTarget">,
  metricLabel: string,
) {
  if (challenge.metric === "manual") {
    return challenge.manualMode === "quantity" && challenge.dailyTarget
      ? `Tagesziel ${formatNumber(challenge.dailyTarget)}`
      : "Täglich abhaken";
  }
  return challenge.exerciseName ? `${metricLabel} · ${challenge.exerciseName}` : metricLabel;
}

/** Zeile im Abschluss-Bildschirm: Zuwachs und neuer Stand. */
export function workoutUpdateText(update: ChallengeWorkoutUpdate) {
  if (update.entryPending) return "Heute noch nicht eingetragen";
  const gained = `+${formatScore(update.metric, update.gained)}`;
  if (update.scoring === "team_goal" && update.goalValue) {
    const percent = Math.min(100, Math.round((update.teamScore / update.goalValue) * 100));
    return `${gained} · Team-Ziel ${percent} %`;
  }
  if (update.scoring === "goal" && update.goalValue) {
    return `${gained} · jetzt ${formatScore(update.metric, update.score)} von ${formatScore(update.metric, update.goalValue)}`;
  }
  return `${gained} · jetzt ${formatScore(update.metric, update.score)}`;
}
