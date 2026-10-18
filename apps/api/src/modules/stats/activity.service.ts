import {
  MAX_WORKOUT_MINUTES,
  MIN_WORKOUT_MINUTES,
  addDays,
  isoWeekOf,
  isoWeekStart,
  shiftIsoWeek,
  todayIsoDate,
  type ActivityDay,
  type ActivityResponse,
  type ActivityWeek,
  type ActivityWeekStatus,
} from "@athletept/shared";
import type { Types } from "mongoose";

import { getAthleteOfCoach } from "../athletes/athlete-access";
import {
  TrainingPlanModel,
  TrainingPlanVersionModel,
  type StoredPlan,
  type StoredPlanVersion,
} from "../plans/plan.model";
import { WorkoutLogModel, type StoredWorkoutLog } from "../workouts/workout-log.model";

/**
 * Trainingskalender mit Streak. Eine Woche zählt, wenn mindestens ein Training abgeschlossen
 * ist und am Sonntag der Woche ein Plan aktiv war. Berechnet, nichts gespeichert.
 */
type PlanForActivity = Pick<StoredPlan, "_id" | "days" | "activatedAt" | "archivedAt">;
type VersionForActivity = Pick<StoredPlanVersion, "planId" | "days" | "replacedAt">;
type LogForActivity = Pick<
  StoredWorkoutLog,
  "_id" | "date" | "dayName" | "startedAt" | "completedAt"
>;

/** Kalendertag eines Zeitpunkts in APP_TIME_ZONE. */
const dayOf = (date: Date) => todayIsoDate(date);

function monthBounds(month: string) {
  const [year, number] = month.split("-").map(Number);
  const next =
    number === 12 ? `${year! + 1}-01` : `${year}-${String(number! + 1).padStart(2, "0")}`;
  return { start: `${month}-01`, end: addDays(`${next}-01`, -1) };
}

/** Trainings, die eine Woche für die Streak braucht. */
const REQUIRED_WORKOUTS_PER_WEEK = 1;

/** Anzahl Trainingstage, die am Tag `endDate` (Ende des Tages) galten. `null` ohne aktiven Plan. */
function plannedCountAt(
  endDate: string,
  plans: readonly PlanForActivity[],
  versions: readonly VersionForActivity[],
) {
  const plan = plans
    .filter(
      (p) =>
        p.activatedAt &&
        dayOf(p.activatedAt) <= endDate &&
        (!p.archivedAt || dayOf(p.archivedAt) > endDate),
    )
    .sort((a, b) => b.activatedAt!.getTime() - a.activatedAt!.getTime())[0];
  if (!plan) return null;
  // Der erste Stand, der erst nach der Woche ersetzt wurde, galt am Sonntag.
  const version = versions
    .filter((v) => v.planId.equals(plan._id) && dayOf(v.replacedAt) > endDate)
    .sort((a, b) => a.replacedAt.getTime() - b.replacedAt.getTime())[0];
  return (version ?? plan).days.length;
}

export function durationMinutes(log: Pick<LogForActivity, "startedAt" | "completedAt">) {
  if (!log.completedAt) return null;
  const minutes = Math.round((log.completedAt.getTime() - log.startedAt.getTime()) / 60_000);
  return minutes >= MIN_WORKOUT_MINUTES && minutes <= MAX_WORKOUT_MINUTES ? minutes : null;
}

export function buildActivity(
  month: string,
  today: string,
  plans: readonly PlanForActivity[],
  versions: readonly VersionForActivity[],
  logs: readonly LogForActivity[],
): ActivityResponse {
  const { start, end } = monthBounds(month);
  const currentWeek = isoWeekOf(today);
  const completedPerWeek = new Map<string, number>();
  for (const log of logs) {
    const week = isoWeekOf(log.date);
    completedPerWeek.set(week, (completedPerWeek.get(week) ?? 0) + 1);
  }

  const weekOf = (week: string): ActivityWeek => {
    const startDate = isoWeekStart(week);
    const endDate = addDays(startDate, 6);
    const completedCount = completedPerWeek.get(week) ?? 0;
    const plannedCount = plannedCountAt(endDate, plans, versions);
    let status: ActivityWeekStatus;
    if (startDate > today) status = "upcoming";
    else if (!plannedCount) status = "paused";
    else if (completedCount >= REQUIRED_WORKOUTS_PER_WEEK) status = "fulfilled";
    else if (endDate >= today) status = "open";
    // Angebrochene Woche ohne Training: Plan erst im Laufe der Woche aktiviert.
    else if (plannedCountAt(startDate, plans, versions) === null) status = "paused";
    else status = "missed";
    return { week, startDate, status, completedCount, plannedCount };
  };

  // Streak: von dieser Woche rückwärts bis zur ersten nicht erfüllten Woche.
  const firstActivation = plans
    .map((p) => p.activatedAt)
    .filter((d): d is Date => d !== null)
    .map(dayOf)
    .sort()[0];
  let streakWeeks = 0;
  if (firstActivation) {
    const firstWeek = isoWeekOf(firstActivation);
    for (let week = currentWeek; week >= firstWeek; week = shiftIsoWeek(week, -1)) {
      const { status } = weekOf(week);
      if (status === "missed") break;
      if (status === "fulfilled") streakWeeks += 1;
    }
  }

  const weeks: ActivityWeek[] = [];
  for (let week = isoWeekOf(start); week <= isoWeekOf(end); week = shiftIsoWeek(week, 1)) {
    weeks.push(weekOf(week));
  }

  const days = new Map<string, ActivityDay>();
  const durations: number[] = [];
  let workoutCount = 0;
  for (const log of logs) {
    if (log.date < start || log.date > end) continue;
    const minutes = durationMinutes(log);
    if (minutes !== null) durations.push(minutes);
    workoutCount += 1;
    const day = days.get(log.date) ?? { date: log.date, workouts: [] };
    day.workouts.push({ id: log._id.toString(), dayName: log.dayName, durationMinutes: minutes });
    days.set(log.date, day);
  }
  const totalMinutes = durations.reduce((sum, m) => sum + m, 0);

  return {
    month,
    today,
    streakWeeks,
    weeks,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    workoutCount,
    totalMinutes,
    averageMinutes: durations.length > 0 ? Math.round(totalMinutes / durations.length) : null,
  };
}

async function loadActivity(athleteId: string | Types.ObjectId, month: string | undefined) {
  const today = todayIsoDate();
  const [plans, versions, logs] = await Promise.all([
    TrainingPlanModel.find(
      { athleteId, activatedAt: { $ne: null } },
      { days: 1, activatedAt: 1, archivedAt: 1 },
    ).lean<PlanForActivity[]>(),
    TrainingPlanVersionModel.find({ athleteId }, { planId: 1, days: 1, replacedAt: 1 }).lean<
      VersionForActivity[]
    >(),
    WorkoutLogModel.find(
      { athleteId, status: "completed" },
      { date: 1, dayName: 1, startedAt: 1, completedAt: 1 },
    )
      .sort({ date: 1, startedAt: 1 })
      .lean<LogForActivity[]>(),
  ]);
  return buildActivity(month ?? today.slice(0, 7), today, plans, versions, logs);
}

export function getMyActivity(athleteId: string, month: string | undefined) {
  return loadActivity(athleteId, month);
}

export async function getAthleteActivity(
  coachId: string,
  athleteId: string,
  month: string | undefined,
) {
  const athlete = await getAthleteOfCoach(coachId, athleteId);
  return loadActivity(athlete._id, month);
}
