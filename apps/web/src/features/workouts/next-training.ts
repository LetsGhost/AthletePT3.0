import {
  addDays,
  type PlanDay,
  type PlanExercise,
  type PlanType,
  type WeekDayStatus,
  type WeekView,
  type Weekday,
} from "@athletept/shared";

import { formatSetGroup, groupSets } from "@/features/plans/format";
import fullBody from "@/features/plans/images/full-body.svg";
import legs from "@/features/plans/images/legs.svg";
import upperBody from "@/features/plans/images/upper-body.svg";

import { dateOfWeekday, weekdayOf } from "./format";

/** Muskelbild zum Schwerpunkt eines Tags. Unterkörper zeigt die Beine. */
export const dayImages: Record<PlanType, string> = {
  UPPER: upperBody,
  LEGS: legs,
  LOWER: legs,
  FULLBODY: fullBody,
};

/** Für die Schätzung: Dauer eines Satzes nach Wiederholungen und Pause ohne Vorgabe. */
const SET_SECONDS = 40;
const DEFAULT_REST_SECONDS = 90;
const WARMUP_ITEM_SECONDS = 3 * 60;

export function workingSetCount(day: Pick<PlanDay, "exercises">) {
  return day.exercises.reduce(
    (sum, entry) => sum + entry.sets.filter((s) => s.kind === "working").length,
    0,
  );
}

/**
 * Grobe Dauer in Minuten, auf 5 gerundet: jeder Satz ca. 40 s (bzw. seine Dauer), danach die
 * Pause aus dem Plan (ohne Angabe 90 s), jeder Warm-up-Eintrag 3 min.
 */
export function estimateMinutes(day: Pick<PlanDay, "exercises" | "warmup">) {
  let seconds = day.warmup.length * WARMUP_ITEM_SECONDS;
  day.exercises.forEach((entry, e) => {
    entry.sets.forEach((set, s) => {
      seconds += set.durationSeconds ?? SET_SECONDS;
      const last = e === day.exercises.length - 1 && s === entry.sets.length - 1;
      if (!last) seconds += entry.restSeconds ?? DEFAULT_REST_SECONDS;
    });
  });
  return Math.max(5, Math.round(seconds / 300) * 5);
}

/** Arbeitssätze kompakt, z. B. „3 × 6–8 Wdh. · 80 kg“; weitere Varianten als „…“. */
export function exerciseScheme(entry: Pick<PlanExercise, "sets">) {
  const groups = groupSets(entry.sets).filter((g) => g.kind === "working");
  const first = groups[0];
  if (!first) return "";
  return groups.length > 1 ? `${formatSetGroup(first)} …` : formatSetGroup(first);
}

/**
 * Was als Nächstes ansteht:
 * - `running`: laufendes Training
 * - `planned`: nächster offener Tag ab heute, sonst ein flexibler Tag
 * - `overdue`: nur noch offene Tage, deren Wochentag schon vorbei ist
 * - `nextWeek`: alles erledigt, der erste Tag der nächsten Woche
 */
export type NextTrainingKind = "running" | "planned" | "overdue" | "nextWeek";

export interface NextTraining {
  kind: NextTrainingKind;
  day: PlanDay;
  /** Geplantes Datum, `null` bei flexiblen Tagen. */
  date: string | null;
}

const byWeekday = (a: PlanDay, b: PlanDay) => (a.weekday ?? 8) - (b.weekday ?? 8);

export function statusOf(week: WeekView, dayId: string): WeekDayStatus {
  return week.days.find((d) => d.dayId === dayId)?.status ?? "open";
}

export function findNextTraining(days: readonly PlanDay[], week: WeekView): NextTraining | null {
  if (days.length === 0) return null;
  const dateOf = (day: PlanDay, offset = 0) =>
    day.weekday === null
      ? null
      : addDays(dateOfWeekday(week.startDate, day.weekday as Weekday), offset);

  const running = week.inProgress && days.find((d) => d.id === week.inProgress!.dayId);
  if (running) return { kind: "running", day: running, date: week.inProgress!.date };

  const today = weekdayOf(week.today);
  const open = days.filter((d) => statusOf(week, d.id) === "open").sort(byWeekday);
  const upcoming =
    open.find((d) => d.weekday !== null && d.weekday >= today) ??
    open.find((d) => d.weekday === null);
  if (upcoming) return { kind: "planned", day: upcoming, date: dateOf(upcoming) };
  if (open[0]) return { kind: "overdue", day: open[0], date: dateOf(open[0]) };

  const first = [...days].sort(byWeekday)[0]!;
  return { kind: "nextWeek", day: first, date: dateOf(first, 7) };
}
