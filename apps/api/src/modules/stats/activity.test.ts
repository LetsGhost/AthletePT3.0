import {
  addDays,
  todayIsoDate,
  type ActivityResponse,
  type Plan,
  type UpdateWorkoutRequest,
  type WorkoutLog,
} from "@athletept/shared";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, login } from "../../../test/helpers";
import { buildActivity, durationMinutes } from "./activity.service";

/** Berliner Mittag eines Kalendertags, damit der Tag eindeutig ist. */
const at = (date: string, time = "10:00") => new Date(`${date}T${time}:00+02:00`);
const days = (count: number) => Array.from({ length: count }, () => ({}) as never);

function plan(activated: string, dayCount: number, archived: string | null = null) {
  return {
    _id: new Types.ObjectId(),
    days: days(dayCount),
    activatedAt: at(activated),
    archivedAt: archived ? at(archived) : null,
  };
}

function log(date: string, minutes = 60) {
  const startedAt = at(date);
  return {
    _id: new Types.ObjectId(),
    date,
    dayName: "Tag A",
    startedAt,
    completedAt: new Date(startedAt.getTime() + minutes * 60_000),
  };
}

// Donnerstag, 15. Oktober 2026 (KW 42). Montage: 21.9., 28.9., 5.10., 12.10.
const today = "2026-10-15";

describe("Trainingskalender (Berechnung)", () => {
  it("zählt erfüllte Wochen, die laufende Woche bricht die Streak nicht", () => {
    const plans = [plan("2026-09-20", 2)];
    const logs = [
      log("2026-09-22"),
      log("2026-09-24"), // KW 39 erfüllt
      log("2026-09-29"), // KW 40 nur 1 von 2: bricht
      log("2026-10-05"),
      log("2026-10-07"), // KW 41 erfüllt
      log("2026-10-12"), // KW 42 läuft, 1 von 2
    ];
    const result = buildActivity("2026-10", today, plans, [], logs);

    expect(result.streakWeeks).toBe(1);
    expect(result.weeks.map((w) => [w.week, w.status])).toEqual([
      ["2026-W40", "missed"],
      ["2026-W41", "fulfilled"],
      ["2026-W42", "open"],
      ["2026-W43", "upcoming"],
      ["2026-W44", "upcoming"],
    ]);
    // Nur Tage im Oktober.
    expect(result.days.map((d) => d.date)).toEqual(["2026-10-05", "2026-10-07", "2026-10-12"]);
    expect(result.workoutCount).toBe(3);
  });

  it("zählt die laufende Woche mit, sobald sie erfüllt ist", () => {
    const plans = [plan("2026-10-01", 1)];
    const logs = [log("2026-10-06"), log("2026-10-13")];

    expect(buildActivity("2026-10", today, plans, [], logs).streakWeeks).toBe(2);
  });

  it("pausiert in Wochen ohne aktiven Plan", () => {
    // Erster Plan bis Mi., 30.9. (KW 40), zweiter ab Mo., 12.10. (KW 42).
    const plans = [plan("2026-09-21", 1, "2026-09-30"), plan("2026-10-12", 1)];
    const logs = [log("2026-09-22"), log("2026-10-13")];
    const result = buildActivity("2026-10", today, plans, [], logs);

    expect(result.weeks.slice(0, 3)).toMatchObject([
      { week: "2026-W40", status: "paused", plannedCount: null },
      { week: "2026-W41", status: "paused", plannedCount: null },
      { week: "2026-W42", status: "fulfilled", plannedCount: 1 },
    ]);
    // KW 42 und KW 39.
    expect(result.streakWeeks).toBe(2);
  });

  it("pausiert die angebrochene Woche, in der ein Plan aktiviert wurde", () => {
    // Aktiviert am Do., 1.10. mit 3 Tagen, in KW 40 nur ein Training.
    const plans = [plan("2026-10-01", 3)];
    const logs = [log("2026-10-02"), log("2026-10-05"), log("2026-10-07"), log("2026-10-09")];
    const result = buildActivity("2026-10", today, plans, [], logs);

    expect(result.weeks[0]).toMatchObject({ week: "2026-W40", status: "paused", plannedCount: 3 });
    expect(result.weeks[1]).toMatchObject({ week: "2026-W41", status: "fulfilled" });
    expect(result.streakWeeks).toBe(1);
  });

  it("nimmt den Planstand, der am Sonntag galt", () => {
    const current = plan("2026-09-28", 3);
    // Bis 8.10. hatte der Plan nur einen Tag.
    const versions = [{ planId: current._id, days: days(1), replacedAt: at("2026-10-08") }];
    const result = buildActivity("2026-10", today, [current], versions, [log("2026-09-29")]);

    expect(result.weeks[0]).toMatchObject({ status: "fulfilled", plannedCount: 1 });
    expect(result.weeks[1]).toMatchObject({ status: "missed", plannedCount: 3 });
  });

  it("rechnet Trainingszeit nur aus aussagekräftigen Dauern", () => {
    const plans = [plan("2026-10-01", 3)];
    const logs = [log("2026-10-05", 50), log("2026-10-06", 70), log("2026-10-07", 0)];
    const result = buildActivity("2026-10", today, plans, [], logs);

    expect(result.totalMinutes).toBe(120);
    expect(result.averageMinutes).toBe(60);
    expect(result.days[2]!.workouts[0]!.durationMinutes).toBeNull();
    expect(durationMinutes(log("2026-10-05", 600))).toBeNull();
  });

  it("hat ohne Plan keine Streak", () => {
    const result = buildActivity("2026-10", today, [], [], []);
    expect(result).toMatchObject({ streakWeeks: 0, workoutCount: 0, averageMinutes: null });
    expect(result.weeks.every((w) => ["paused", "upcoming"].includes(w.status))).toBe(true);
  });
});

describe("Trainingskalender (API)", () => {
  async function setup() {
    const admin = await createAndLogin({ role: "sysadmin" });
    const exercise = await api()
      .post("/api/v1/exercises")
      .set("Authorization", admin.bearer)
      .send({
        name: "Kniebeuge",
        category: "compound",
        equipment: "barbell",
        primaryMuscles: ["quads"],
      });
    const coach = await createAndLogin({ role: "coach" });
    const athleteUser = await createUser({ role: "athlete", coachId: coach.user._id });
    const athlete = await login(athleteUser.email);
    const athleteId = athleteUser.id as string;
    const created = await api()
      .post(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", coach.bearer)
      .send({
        name: "Block 1",
        days: [
          {
            name: "Tag A",
            exercises: [{ exerciseId: exercise.body.id, sets: [{ kind: "working", repsMin: 5 }] }],
          },
        ],
      });
    const activated = await api()
      .post(`/api/v1/athletes/${athleteId}/plans/${(created.body as Plan).id}/activate`)
      .set("Authorization", coach.bearer);
    return { coach, athlete, athleteId, dayId: (activated.body as Plan).days[0]!.id };
  }

  it("liefert Kalender und Streak für Athlet und Coach", async () => {
    const { coach, athlete, athleteId, dayId } = await setup();
    const today = todayIsoDate();
    const started = await api()
      .post("/api/v1/me/workout-logs")
      .set("Authorization", athlete.bearer)
      .send({ dayId, date: today });
    const completed = await api()
      .post(`/api/v1/me/workout-logs/${started.body.id}/complete`)
      .set("Authorization", athlete.bearer)
      .send({
        revision: started.body.revision,
        rating: null,
        notes: null,
        exercises: (started.body as WorkoutLog).exercises.map((e) => ({
          id: e.id,
          sets: [{ weightKg: 100, reps: 5, done: true }],
        })),
      } satisfies UpdateWorkoutRequest);
    expect(completed.status).toBe(200);

    const mine = await api().get("/api/v1/me/activity").set("Authorization", athlete.bearer);
    expect(mine.status).toBe(200);
    const body = mine.body as ActivityResponse;
    expect(body.month).toBe(today.slice(0, 7));
    expect(body.streakWeeks).toBe(1);
    expect(body.days).toEqual([
      { date: today, workouts: [{ id: started.body.id, dayName: "Tag A", durationMinutes: null }] },
    ]);

    const coachView = await api()
      .get(`/api/v1/athletes/${athleteId}/activity?month=${addDays(today, -40).slice(0, 7)}`)
      .set("Authorization", coach.bearer);
    expect(coachView.status).toBe(200);
    expect((coachView.body as ActivityResponse).streakWeeks).toBe(1);
  });

  it("prüft Monat und Zugriff", async () => {
    const { athlete, athleteId } = await setup();
    const invalid = await api()
      .get("/api/v1/me/activity?month=2026-13")
      .set("Authorization", athlete.bearer);
    expect(invalid.status).toBe(400);

    const other = await createAndLogin({ role: "coach" });
    const foreign = await api()
      .get(`/api/v1/athletes/${athleteId}/activity`)
      .set("Authorization", other.bearer);
    expect(foreign.status).toBe(404);
  });
});
