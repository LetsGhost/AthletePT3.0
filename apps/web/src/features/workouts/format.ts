import { addDays, isoWeekday, type Weekday, type WorkoutSet } from "@athletept/shared";

import { formatDuration } from "@/features/plans/format";
import { formatNumber } from "@/lib/format";

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

function toLocal(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

/** „Di., 13. Okt.“ */
export function formatWeekdayDate(date: string) {
  return weekdayDate.format(toLocal(date));
}

/** „Dienstag, 13. Oktober 2026“ */
export function formatLongDate(date: string) {
  return longDate.format(toLocal(date));
}

/** „KW 42 · 12.–18. Okt.“ */
export function formatWeek(week: string, startDate: string) {
  const end = addDays(startDate, 6);
  return `KW ${Number(week.slice(6))} · ${shortDate.format(toLocal(startDate))} – ${shortDate.format(toLocal(end))}`;
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
