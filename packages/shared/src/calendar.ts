import { z } from "zod";

/**
 * Zeitzone, in der Kalendertage und Trainingswochen gelten. Protokolle speichern den Kalendertag
 * (`YYYY-MM-DD`), daraus folgt die ISO-Woche. „Heute“ bestimmt sich immer in dieser Zeitzone,
 * unabhängig von der Zeitzone des Servers.
 */
export const APP_TIME_ZONE = "Europe/Berlin";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Heutiger Kalendertag in `APP_TIME_ZONE`. */
export function todayIsoDate(now = new Date()) {
  return dayFormat.format(now);
}

function toUtc(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function fromUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const result = toUtc(date);
  result.setUTCDate(result.getUTCDate() + days);
  return fromUtc(result);
}

/** Wochentag nach ISO 8601: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: string) {
  return toUtc(date).getUTCDay() || 7;
}

/** ISO-Woche, z. B. `2026-W42`. Das Jahr ist das ISO-Wochenjahr (Ende Dezember ggf. +1). */
export function isoWeekOf(date: string) {
  // Der Donnerstag derselben Woche liegt immer im richtigen Wochenjahr.
  const thursday = toUtc(addDays(date, 4 - isoWeekday(date)));
  const year = thursday.getUTCFullYear();
  const firstDay = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday.getTime() - firstDay) / 86_400_000 / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Montag einer ISO-Woche. */
export function isoWeekStart(week: string) {
  const [year, number] = week.split("-W").map(Number);
  // Der 4. Januar liegt immer in Woche 1.
  const january4 = `${year}-01-04`;
  const firstMonday = addDays(january4, 1 - isoWeekday(january4));
  return addDays(firstMonday, (number! - 1) * 7);
}

export function shiftIsoWeek(week: string, weeks: number) {
  return isoWeekOf(addDays(isoWeekStart(week), weeks * 7));
}

/** ISO-Woche wie `2026-W42`. Wochen, die es im Jahr nicht gibt (W53), sind ungültig. */
export const isoWeekSchema = z.string().refine((week) => {
  if (!/^\d{4}-W\d{2}$/.test(week) || Number(week.slice(6)) < 1) return false;
  return isoWeekOf(isoWeekStart(week)) === week;
}, "Ungültige Woche");
