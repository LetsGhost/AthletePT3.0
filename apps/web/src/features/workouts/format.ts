import { addDays, isoWeekday, type Weekday, type WorkoutSet } from "@athletept/shared";

import { formatDuration } from "@/features/plans/format";
import { formatNumber, parseIsoDate } from "@/lib/format";

const shortDate = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
const weekdayDate = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const longDate = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dayMonth = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** „Di., 13. Okt.“ */
export function formatWeekdayDate(date: string) {
  return weekdayDate.format(parseIsoDate(date));
}

/** „Dienstag, 13. Oktober 2026“ */
export function formatLongDate(date: string) {
  return longDate.format(parseIsoDate(date));
}

/** „Dienstag, 13. Oktober“ */
export function formatDayMonth(date: string) {
  return dayMonth.format(parseIsoDate(date));
}

/** „KW 42 · 12.–18. Okt.“ */
export function formatWeek(week: string, startDate: string) {
  const end = addDays(startDate, 6);
  return `KW ${Number(week.slice(6))} · ${shortDate.format(parseIsoDate(startDate))} – ${shortDate.format(parseIsoDate(end))}`;
}

/** Datum eines Wochentags in der Woche ab `startDate` (Montag). */
export function dateOfWeekday(startDate: string, weekday: Weekday) {
  return addDays(startDate, weekday - 1);
}

export function weekdayOf(date: string) {
  return isoWeekday(date) as Weekday;
}

/** „80 kg × 8“, „× 12“ (ohne Gewicht), „45 s“, „20 kg · 45 s“. */
export function formatPerformed(set: Pick<WorkoutSet, "weightKg" | "reps" | "durationSeconds">) {
  const weight = set.weightKg !== null ? `${formatNumber(set.weightKg)} kg` : null;
  if (set.durationSeconds !== null) {
    return [weight, formatDuration(set.durationSeconds)].filter(Boolean).join(" · ");
  }
  if (set.reps === null) return weight ?? "–";
  return weight ? `${weight} × ${set.reps}` : `${set.reps} Wdh.`;
}

/** Erledigte Sätze kompakt: „80 kg × 8, 80 kg × 7“. */
export function formatPerformedSets(sets: readonly WorkoutSet[]) {
  return sets.map(formatPerformed).join(", ");
}

/** Für Zahlenfelder: deutsches Komma erlauben. Leer wird `null`, Unsinn `NaN`. */
export function parseDecimal(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  return Number(trimmed);
}

export function decimalToText(value: number | null) {
  return value === null ? "" : String(value).replace(".", ",");
}

/** Stoppuhr: „1:45“, „1:02:09“. */
export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Trainingsdauer: „48 min“, „1 h 05 min“. */
export function formatWorkoutDuration(totalSeconds: number) {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} h ${String(minutes % 60).padStart(2, "0")} min` : `${minutes} min`;
}
