import {
  badgeTierLabels,
  badgeTiers,
  daysInPeriod,
  type ChallengeDetail,
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
  challenge: Pick<ChallengeSummary, "status" | "startDate" | "endDate" | "today"> & {
    duel?: ChallengeSummary["duel"];
  },
) {
  if (challenge.duel?.state === "pending") {
    const hours = Math.max(0, (Date.parse(challenge.duel.expiresAt) - Date.now()) / 3_600_000);
    return hours < 24
      ? "Einladung läuft heute ab"
      : `Einladung noch ${Math.floor(hours / 24)} ${Math.floor(hours / 24) === 1 ? "Tag" : "Tage"}`;
  }
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
  challenge: Pick<
    ChallengeSummary,
    "scoring" | "goalValue" | "teamScore" | "leader" | "me" | "duel" | "tiers"
  >,
) {
  const score = challenge.me?.score ?? 0;
  if (challenge.tiers) return Math.min(1, score / challenge.tiers[2]!);
  if (challenge.duel) {
    // Anteil am gemeinsamen Wert, 50 % bei Gleichstand.
    return challenge.teamScore > 0 ? score / challenge.teamScore : 0.5;
  }
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
  if (challenge.duel) return duelStanding(challenge);
  const me = challenge.me;
  if (challenge.tiers) {
    return me
      ? `Platz ${me.rank} von ${challenge.participantCount}`
      : `${challenge.participantCount} dabei`;
  }
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

/** Zwei Werte in derselben Einheit, z. B. für „9 : 7“ im Duell. */
export function pairScores(metric: ChallengeMetric, a: number, b: number) {
  if (metric === "volume" && Math.max(a, b) >= 1000) {
    return { a: formatNumber(a / 1000), b: formatNumber(b / 1000), unit: "Tonnen" };
  }
  return { a: formatNumber(a), b: formatNumber(b), unit: scoreParts(metric, 2).unit };
}

/** „Duell vs. Lena B.“, solange unbekannt die eingegebene Adresse. */
export function duelTitle(challenge: Pick<ChallengeSummary, "duel">) {
  const duel = challenge.duel!;
  return `Duell vs. ${duel.opponentName ?? duel.invitedEmail ?? "Unbekannt"}`;
}

/** „9 : 7“ aus Sicht des Athleten (eigener Wert zuerst). */
export function duelScoreText(challenge: ChallengeSummary) {
  const mine = challenge.me?.score ?? 0;
  const { a, b, unit } = pairScores(challenge.metric, mine, challenge.teamScore - mine);
  return `${a} : ${b} ${unit}`;
}

/** „Du führst“, „Lena B. führt“, „Gewonnen“ … Aus Coach-Sicht ohne „Du“. */
export function duelStanding(challenge: ChallengeSummary) {
  const duel = challenge.duel!;
  if (duel.state === "pending") {
    return duel.iAmChallenger === false ? "Einladung offen" : "Wartet auf Antwort";
  }
  const mine = challenge.me?.score ?? 0;
  const theirs = challenge.teamScore - mine;
  const coachView = duel.iAmChallenger === null;
  if (challenge.status === "finished") {
    if (challenge.me?.achieved) return "Gewonnen";
    return challenge.me?.achieved === false && (mine !== theirs || duel.gaveUpName)
      ? "Verloren"
      : "Unentschieden";
  }
  if (mine === theirs) return "Gleichstand";
  if (mine > theirs) return coachView ? "führt" : "Du führst";
  return coachView ? "liegt zurück" : `${duel.opponentName ?? "Gegner"} führt`;
}

/** Was bis zur nächsten Stufe fehlt, z. B. „Noch 600 kg bis Silber“. */
export function nextTierHint(challenge: Pick<ChallengeDetail, "tiers" | "me" | "metric">) {
  const me = challenge.me;
  if (!challenge.tiers || !me) return null;
  const next = challenge.tiers.findIndex((threshold) => me.score < threshold);
  if (next === -1) return "Gold erreicht";
  return `Noch ${formatScore(challenge.metric, challenge.tiers[next]! - me.score)} bis ${badgeTierLabels[badgeTiers[next]!]}`;
}
