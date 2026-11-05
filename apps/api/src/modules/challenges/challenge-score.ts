import {
  addDays,
  daysInPeriod,
  isoWeekOf,
  isoWeekday,
  type ChallengeMetric,
  type ChallengeScoring,
  type ManualMode,
} from "@athletept/shared";

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
  /** Plantag, für die Planerfüllung. */
  dayId: string;
  /** Anteil der nicht übersprungenen Übungen, 0 bis 1 (ohne Übungen 1). */
  doneShare: number;
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

const chronological = (logs: readonly ScoreLog[]) =>
  [...logs].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
  );

const logTime = (log: ScoreLog) =>
  log.completedAt?.getTime() ?? Date.parse(`${log.date}T12:00:00Z`);

/**
 * Geplante Einheiten im Zeitraum: feste Wochentage so oft, wie sie vorkommen, flexible Tage
 * anteilig (ein flexibler Tag zählt aber mindestens einmal, auch bei kurzen Challenges).
 */
export function plannedSessions(
  weekdays: readonly (number | null)[],
  startDate: string,
  endDate: string,
) {
  const days = daysInPeriod(startDate, endDate);
  let fixed = 0;
  for (let i = 0; i < days; i += 1) {
    const weekday = isoWeekday(addDays(startDate, i));
    fixed += weekdays.filter((w) => w === weekday).length;
  }
  const flexible = weekdays.filter((w) => w === null).length;
  return fixed + Math.max(Math.round((flexible * days) / 7), Math.min(flexible, 1));
}

/**
 * Planerfüllung in Prozent der geplanten Einheiten des ganzen Zeitraums, damit der Wert nur
 * steigt. Jeder Plantag zählt je Woche einmal (bestes Protokoll), übersprungene Übungen anteilig.
 */
function tallyAdherence(logs: readonly ScoreLog[], planned: number): Tally {
  const tally: Tally = { score: 0, reachedAt: Infinity };
  if (planned <= 0) return tally;
  const credit = new Map<string, number>();
  let done = 0;
  for (const log of chronological(logs)) {
    const key = `${isoWeekOf(log.date)}|${log.dayId}`;
    const previous = credit.get(key) ?? 0;
    if (log.doneShare <= previous) continue;
    credit.set(key, log.doneShare);
    done += log.doneShare - previous;
    const next = Math.min(100, (done / planned) * 100);
    if (next > tally.score) {
      tally.score = next;
      tally.reachedAt = logTime(log);
    }
  }
  tally.score = round1(tally.score);
  return tally;
}

function tallyLogs(definition: ScoreDefinition, logs: readonly ScoreLog[]): Tally {
  const sorted = chronological(logs);
  const tally: Tally = { score: 0, reachedAt: Infinity };
  const days = new Set<string>();
  for (const log of sorted) {
    const at = logTime(log);
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
  /** Geplante Einheiten je Athlet, nur für die Planerfüllung. */
  planned: ReadonlyMap<string, number> = new Map(),
): ScoreResult {
  const inPeriod = (date: string) => date >= definition.startDate && date <= definition.lastDate;
  const tallies = participantIds.map((athleteId) => {
    const own = logs.filter((l) => l.athleteId === athleteId && inPeriod(l.date));
    let tally: Tally;
    if (definition.metric === "manual") {
      tally = tallyEntries(
        definition,
        entries.filter((e) => e.athleteId === athleteId && inPeriod(e.date)),
      );
    } else if (definition.metric === "plan_adherence") {
      tally = tallyAdherence(own, planned.get(athleteId) ?? 0);
    } else tally = tallyLogs(definition, own);
    return { athleteId, ...tally };
  });
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
