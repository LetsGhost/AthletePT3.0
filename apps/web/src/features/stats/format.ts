import type {
  ExerciseChange,
  ExerciseSession,
  ExerciseStatsSummary,
  RecordKind,
  StatsMetric,
} from "@athletept/shared";

import { formatDuration } from "@/features/plans/format";
import { formatWeekdayDate } from "@/features/workouts/format";
import { formatNumber, parseIsoDate } from "@/lib/format";

/** „97,5 kg“, „12 Wdh.“, „1 min“. */
export function formatRecordValue(kind: RecordKind, value: number) {
  if (kind === "maxReps") return `${value} Wdh.`;
  if (kind === "maxDurationSeconds") return formatDuration(value);
  return `${formatNumber(value)} kg`;
}

export const metricLabels: Record<StatsMetric, string> = {
  estimated1rm: "Geschätztes Maximum",
  topWeightKg: "Höchstes Gewicht",
  maxReps: "Meiste Wiederholungen",
  maxDurationSeconds: "Längste Dauer",
};

/** „+5 %“, „−2,3 %“, „±0 %“ (mit echtem Minuszeichen). */
export function formatPercent(percent: number) {
  if (percent === 0) return "±0 %";
  const sign = percent > 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(percent))} %`;
}

export function changeTone(change: ExerciseChange | null) {
  if (!change || change.percent === 0) return "neutral" as const;
  return change.percent > 0 ? ("up" as const) : ("down" as const);
}

/** Aktueller Stand der Hauptkennzahl (letzte Einheit), z. B. „116,7 kg“. */
export function mainCurrent(summary: ExerciseStatsSummary) {
  const value = summary.trend.at(-1) ?? summary.best[summary.metric]?.value;
  return value === undefined ? "–" : formatRecordValue(summary.metric, value);
}

/** „58 min“, „9 h 40 min“, „2 h“. */
export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long" });
const monthYearFormat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

/** „Oktober“, aus einem anderen Jahr „Oktober 2025“. */
export function formatMonth(month: string, today: string) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year!, number! - 1, 1);
  return (month.slice(0, 4) === today.slice(0, 4) ? monthFormat : monthYearFormat).format(date);
}

/** Monat davor bzw. danach, z. B. `2026-10` → `2026-11`. */
export function shiftMonth(month: string, months: number) {
  const [year, number] = month.split("-").map(Number);
  const index = year! * 12 + (number! - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Kennzahlen, die das Diagramm einer Übung zeigen kann. */
export type ChartKind = StatsMetric | "volumeKg";

export const chartLabels: Record<ChartKind, string> = {
  estimated1rm: "Gesch. Max.",
  topWeightKg: "Höchstes Gewicht",
  maxReps: "Wiederholungen",
  maxDurationSeconds: "Dauer",
  volumeKg: "Volumen",
};

/** Umschaltbare Kennzahlen je Hauptkennzahl (ohne Gewicht nur die eine). */
export const chartKinds: Record<StatsMetric, ChartKind[]> = {
  estimated1rm: ["estimated1rm", "topWeightKg", "volumeKg"],
  topWeightKg: ["topWeightKg", "volumeKg"],
  maxReps: ["maxReps"],
  maxDurationSeconds: ["maxDurationSeconds"],
};

export function formatChartValue(kind: ChartKind, value: number) {
  return kind === "volumeKg" ? `${formatNumber(value)} kg` : formatRecordValue(kind, value);
}

/** „97,5 kg × 10“, `null` ohne Satz mit Gewicht. */
export function formatBestSet(session: Pick<ExerciseSession, "bestSetWeightKg" | "bestSetReps">) {
  if (session.bestSetWeightKg === null) return null;
  const weight = `${formatNumber(session.bestSetWeightKg)} kg`;
  return session.bestSetReps === null ? weight : `${weight} × ${session.bestSetReps}`;
}

const shortDate = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });

/** „13. Okt.“ */
export function formatShortDate(date: string) {
  return shortDate.format(parseIsoDate(date));
}

/** „6 Einheiten · zuletzt Fr., 30. Okt.“ */
export function sessionsText(summary: Pick<ExerciseStatsSummary, "sessionCount" | "lastDate">) {
  return `${summary.sessionCount} ${summary.sessionCount === 1 ? "Einheit" : "Einheiten"} · zuletzt ${formatWeekdayDate(summary.lastDate)}`;
}
