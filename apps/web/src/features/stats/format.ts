import type {
  ExerciseChange,
  ExerciseStatsSummary,
  RecordKind,
  StatsMetric,
} from "@athletept/shared";

import { formatDuration } from "@/features/plans/format";
import { formatNumber } from "@/lib/format";

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

/** Bestwert der Hauptkennzahl, z. B. „116,7 kg“. */
export function mainBest(summary: ExerciseStatsSummary) {
  const record = summary.best[summary.metric];
  return record ? formatRecordValue(summary.metric, record.value) : "–";
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
