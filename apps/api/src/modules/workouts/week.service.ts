import {
  addDays,
  isoWeekOf,
  isoWeekStart,
  todayIsoDate,
  type WeekDayStatus,
  type WeekView,
  type WeeklyActivitiesResponse,
} from "@athletept/shared";
import type { Types } from "mongoose";

import { getAthleteOfCoach } from "../athletes/athlete-access";
import { TrainingPlanModel, type StoredPlan } from "../plans/plan.model";
import { WeeklyActivitiesModel, WorkoutLogModel, type StoredWorkoutLog } from "./workout-log.model";
import { toSummary } from "./workout.service";

const EMPTY_WEEK: (string | null)[] = Array.from({ length: 7 }, () => null);

async function loadActivities(athleteId: string | Types.ObjectId) {
  const doc = await WeeklyActivitiesModel.findOne({ athleteId }).lean<{ activities: string[] }>();
  return EMPTY_WEEK.map((empty, i) => doc?.activities[i] ?? empty);
}

function dayStatus(logs: readonly StoredWorkoutLog[]): WeekDayStatus {
  if (logs.some((l) => l.status === "completed")) return "completed";
  if (logs.some((l) => l.status === "skipped")) return "skipped";
  if (logs.some((l) => l.status === "in_progress")) return "in_progress";
  return "open";
}

/**
 * Berechnet die Woche aus dem aktiven Plan und den Protokollen der ISO-Woche. Es wird nichts
 * gespeichert, deshalb braucht es keinen wöchentlichen Reset.
 */
async function buildWeek(
  athleteId: string,
  week: string | undefined,
  viewer: "athlete" | "coach",
): Promise<WeekView> {
  const today = todayIsoDate();
  const resolvedWeek = week ?? isoWeekOf(today);
  const startDate = isoWeekStart(resolvedWeek);
  const endDate = addDays(startDate, 6);
  const statusFilter = viewer === "coach" ? { status: { $ne: "in_progress" as const } } : {};

  const [plan, logs, activities, inProgress] = await Promise.all([
    TrainingPlanModel.findOne({ athleteId, status: "active" }).lean<StoredPlan>(),
    WorkoutLogModel.find({ athleteId, date: { $gte: startDate, $lte: endDate }, ...statusFilter })
      .sort({ date: 1, startedAt: 1 })
      .lean<StoredWorkoutLog[]>(),
    loadActivities(athleteId),
    viewer === "athlete"
      ? WorkoutLogModel.findOne({ athleteId, status: "in_progress" }).lean<StoredWorkoutLog>()
      : null,
  ]);

  // Feste Wochentage in Wochenreihenfolge, flexible Tage am Ende (in Planreihenfolge).
  const planDays = [...(plan?.days ?? [])].sort((a, b) => (a.weekday ?? 8) - (b.weekday ?? 8));
  const planDayIds = new Set(planDays.map((d) => d._id.toString()));
  const days = planDays.map((day) => {
    const dayLogs = logs.filter((l) => l.dayId.equals(day._id));
    return {
      dayId: day._id.toString(),
      name: day.name,
      type: day.type,
      weekday: day.weekday ?? null,
      status: dayStatus(dayLogs),
      logs: dayLogs.map(toSummary),
    };
  });

  return {
    week: resolvedWeek,
    startDate,
    endDate,
    today,
    plan: plan ? { id: plan._id.toString(), name: plan.name } : null,
    days,
    otherLogs: logs.filter((l) => !planDayIds.has(l.dayId.toString())).map(toSummary),
    activities,
    completedCount: days.filter((d) => d.status === "completed").length,
    plannedCount: days.length,
    inProgress: inProgress ? toSummary(inProgress) : null,
  };
}

export function getMyWeek(athleteId: string, week: string | undefined) {
  return buildWeek(athleteId, week, "athlete");
}

export async function getAthleteWeek(coachId: string, athleteId: string, week: string | undefined) {
  await getAthleteOfCoach(coachId, athleteId);
  return buildWeek(athleteId, week, "coach");
}

export async function updateWeeklyActivities(
  coachId: string,
  athleteId: string,
  activities: (string | null)[],
): Promise<WeeklyActivitiesResponse> {
  const athlete = await getAthleteOfCoach(coachId, athleteId);
  await WeeklyActivitiesModel.updateOne(
    { athleteId: athlete._id },
    { $set: { activities } },
    { upsert: true },
  );
  return { activities: await loadActivities(athlete._id) };
}
