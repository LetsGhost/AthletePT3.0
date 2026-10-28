import type { ChallengeMetric, ChallengeScoring, ManualMode } from "@athletept/shared";

/**
 * Stand einer Challenge, rein aus Trainings und Einträgen berechnet. Ohne Datenbank, damit sich
 * die Wertung einzeln testen lässt.
 */
export interface ScoreDefinition {
  metric: ChallengeMetric;
  exerciseId: string | null;
  manualMode: ManualMode | null;
  dailyTarget: number | null;
  scoring: ChallengeScoring;
  goalValue: number | null;
  startDate: string;
  /** Letzter Tag, der zählt: Ende der Challenge oder heute, was früher ist. */
  lastDate: string;
  finished: boolean;
}

export interface ScoreLog {
  id: string;
  athleteId: string;
  date: string;
  completedAt: Date | null;
  stats: {
    exerciseId: string;
    volumeKg: number | null;
    setCount: number;
    estimated1rm: number | null;
  }[];
}

export interface ScoreEntry {
  athleteId: string;
  date: string;
  value: number;
  updatedAt: Date;
}

export interface Standing {
  athleteId: string;
  score: number;
  rank: number;
  /** Ziel erreicht bzw. bei der Rangliste nach dem Ende Platz 1. `null` = noch offen. */
  achieved: boolean | null;
}

export interface ScoreResult {
  /** Beste zuerst. */
  standings: Standing[];
  teamScore: number;
}

interface Tally {
  score: number;
  /** Zeitpunkt, zu dem der Wert erreicht war. Bei Gleichstand liegt vorn, wer früher dran war. */
  reachedAt: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function logValue(definition: ScoreDefinition, log: ScoreLog) {
  const stats = definition.exerciseId
    ? log.stats.filter((s) => s.exerciseId === definition.exerciseId)
    : log.stats;
  switch (definition.metric) {
    case "volume":
      return stats.reduce((sum, s) => sum + (s.volumeKg ?? 0), 0);
    case "sets":
      return stats.reduce((sum, s) => sum + s.setCount, 0);
    case "e1rm":
      return Math.max(0, ...stats.map((s) => s.estimated1rm ?? 0));
    default:
      return 0;
  }
}

function tallyLogs(definition: ScoreDefinition, logs: readonly ScoreLog[]): Tally {
  const sorted = [...logs].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
  );
  const tally: Tally = { score: 0, reachedAt: Infinity };
  const days = new Set<string>();
  for (const log of sorted) {
    const at = log.completedAt?.getTime() ?? Date.parse(`${log.date}T12:00:00Z`);
    let next = tally.score;
    if (definition.metric === "workouts") next += 1;
    else if (definition.metric === "training_days") {
      if (!days.has(log.date)) next += 1;
      days.add(log.date);
    } else if (definition.metric === "e1rm") next = Math.max(next, logValue(definition, log));
    else next += logValue(definition, log);
    if (next > tally.score) {
      tally.score = next;
      tally.reachedAt = at;
    }
  }
  tally.score = round1(tally.score);
  return tally;
}

/** Freie Vorgabe: Tage, an denen das Tagesziel erreicht bzw. abgehakt wurde. */
function tallyEntries(definition: ScoreDefinition, entries: readonly ScoreEntry[]): Tally {
  const target = definition.manualMode === "quantity" ? (definition.dailyTarget ?? 1) : 1;
  const fulfilled = entries.filter((e) => e.value >= target);
  return {
    score: fulfilled.length,
    reachedAt: fulfilled.length
      ? Math.max(...fulfilled.map((e) => e.updatedAt.getTime()))
      : Infinity,
  };
}

export function computeStandings(
  definition: ScoreDefinition,
  participantIds: readonly string[],
  logs: readonly ScoreLog[],
  entries: readonly ScoreEntry[],
): ScoreResult {
  const inPeriod = (date: string) => date >= definition.startDate && date <= definition.lastDate;
  const tallies = participantIds.map((athleteId) => ({
    athleteId,
    ...(definition.metric === "manual"
      ? tallyEntries(
          definition,
          entries.filter((e) => e.athleteId === athleteId && inPeriod(e.date)),
        )
      : tallyLogs(
          definition,
          logs.filter((l) => l.athleteId === athleteId && inPeriod(l.date)),
        )),
  }));
  tallies.sort((a, b) => b.score - a.score || a.reachedAt - b.reachedAt);

  const teamScore = round1(tallies.reduce((sum, t) => sum + t.score, 0));
  const goal = definition.goalValue;
  const standings = tallies.map((tally, index): Standing => {
    // Geteilter Platz bei gleichem Wert und gleichem Zeitpunkt (z. B. alle noch bei 0).
    const ahead = tallies.findIndex(
      (other) => other.score === tally.score && other.reachedAt === tally.reachedAt,
    );
    const rank = (ahead === -1 ? index : ahead) + 1;
    let achieved: boolean | null;
    if (definition.scoring === "goal") {
      achieved = goal !== null && tally.score >= goal ? true : definition.finished ? false : null;
    } else if (definition.scoring === "team_goal") {
      achieved = goal !== null && teamScore >= goal ? true : definition.finished ? false : null;
    } else {
      achieved = definition.finished ? rank === 1 && tally.score > 0 : null;
    }
    return { athleteId: tally.athleteId, score: tally.score, rank, achieved };
  });
  return { standings, teamScore };
}

export interface DailyValue {
  athleteId: string;
  date: string;
  value: number;
}

/** Wert je Teilnehmer und Tag (nur Tage mit Wert), z. B. für den Verlauf im Duell. */
export function computeDailyValues(
  definition: ScoreDefinition,
  logs: readonly ScoreLog[],
): DailyValue[] {
  const byKey = new Map<string, DailyValue>();
  for (const log of logs) {
    if (log.date < definition.startDate || log.date > definition.lastDate) continue;
    const key = `${log.athleteId}|${log.date}`;
    const entry = byKey.get(key) ?? { athleteId: log.athleteId, date: log.date, value: 0 };
    if (definition.metric === "workouts") entry.value += 1;
    else if (definition.metric === "training_days") entry.value = 1;
    else if (definition.metric === "e1rm")
      entry.value = Math.max(entry.value, logValue(definition, log));
    else entry.value = round1(entry.value + logValue(definition, log));
    byKey.set(key, entry);
  }
  return [...byKey.values()]
    .filter((d) => d.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.athleteId.localeCompare(b.athleteId));
}
