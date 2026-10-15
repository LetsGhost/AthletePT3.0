import {
  addDays,
  todayIsoDate,
  type CompleteWorkoutResponse,
  type CreateExerciseRequest,
  type Exercise,
  type ExerciseStatsDetail,
  type ExerciseStatsListResponse,
  type Plan,
  type UpdateWorkoutRequest,
  type WorkoutLog,
} from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, login } from "../../../test/helpers";
import { WorkoutLogModel } from "../workouts/workout-log.model";
import { WORKOUT_STATS_VERSION, backfillWorkoutStats } from "./exercise-stats.service";

async function createExercise(bearer: string, overrides: Partial<CreateExerciseRequest> = {}) {
  const res = await api()
    .post("/api/v1/exercises")
    .set("Authorization", bearer)
    .send({
      name: "Kniebeuge",
      category: "compound",
      equipment: "barbell",
      primaryMuscles: ["quads", "glutes"],
      ...overrides,
    } satisfies CreateExerciseRequest);
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return res.body as Exercise;
}

/** Athlet mit aktivem Plan: Tag mit Kniebeuge (1 Aufwärm-, 2 Arbeitssätze) und Klimmzügen. */
async function setup() {
  const admin = await createAndLogin({ role: "sysadmin" });
  const squat = await createExercise(admin.bearer);
  const pullUp = await createExercise(admin.bearer, {
    name: "Klimmzüge",
    equipment: "bodyweight",
    primaryMuscles: ["lats"],
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
          exercises: [
            {
              exerciseId: squat.id,
              sets: [
                { kind: "warmup", repsMin: 5, weightKg: 140 },
                { kind: "working", repsMin: 5, weightKg: 100 },
                { kind: "working", repsMin: 5, weightKg: 100 },
              ],
            },
            { exerciseId: pullUp.id, sets: [{ kind: "working", repsMin: 8 }] },
          ],
        },
      ],
    });
  const plan = (
    await api()
      .post(`/api/v1/athletes/${athleteId}/plans/${(created.body as Plan).id}/activate`)
      .set("Authorization", coach.bearer)
  ).body as Plan;
  return { coach, athlete, athleteId, dayId: plan.days[0]!.id, squat, pullUp };
}

type Sets = { weightKg?: number | null; reps?: number | null; done?: boolean }[];

/** Startet und schließt ein Training ab: `squat` und `pullUps` sind die geschafften Sätze. */
async function train(
  bearer: string,
  dayId: string,
  date: string,
  { squat, pullUps, finish = true }: { squat: Sets; pullUps: Sets; finish?: boolean },
) {
  const started = await api()
    .post("/api/v1/me/workout-logs")
    .set("Authorization", bearer)
    .send({ dayId, date });
  expect(started.status).toBe(201);
  const log = started.body as WorkoutLog;
  const toSets = (sets: Sets) =>
    sets.map((s) => ({ weightKg: s.weightKg ?? null, reps: s.reps ?? null, done: s.done ?? true }));
  const body: UpdateWorkoutRequest = {
    revision: log.revision,
    rating: null,
    notes: null,
    exercises: [
      { id: log.exercises[0]!.id, sets: toSets(squat) },
      { id: log.exercises[1]!.id, sets: toSets(pullUps) },
    ],
  };
  const path = `/api/v1/me/workout-logs/${log.id}`;
  const res = finish
    ? await api().post(`${path}/complete`).set("Authorization", bearer).send(body)
    : await api().put(path).set("Authorization", bearer).send(body);
  expect(res.status).toBe(200);
  return res.body as CompleteWorkoutResponse;
}

async function myStats(bearer: string) {
  const res = await api().get("/api/v1/me/exercise-stats").set("Authorization", bearer);
  expect(res.status).toBe(200);
  return res.body as ExerciseStatsListResponse;
}

const today = todayIsoDate();

describe("Übungsanalyse", () => {
  it("ist ohne Trainings leer", async () => {
    const { athlete, squat } = await setup();

    expect(await myStats(athlete.bearer)).toEqual({ items: [], records: [] });
    const detail = await api()
      .get(`/api/v1/me/exercise-stats/${squat.id}`)
      .set("Authorization", athlete.bearer);
    expect(detail.status).toBe(404);
  });

  it("berechnet Bestwerte und Verlauf aus erledigten Arbeitssätzen", async () => {
    const { athlete, dayId, squat, pullUp } = await setup();
    await train(athlete.bearer, dayId, addDays(today, -7), {
      // Aufwärmsatz mit 140 kg zählt nicht.
      squat: [
        { weightKg: 140, reps: 5 },
        { weightKg: 100, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
      pullUps: [{ reps: 8 }],
    });
    await train(athlete.bearer, dayId, addDays(today, -3), {
      squat: [
        { weightKg: 60, reps: 5 },
        { weightKg: 105, reps: 5 },
        // Nicht abgehakt: zählt nicht.
        { weightKg: 150, reps: 5, done: false },
      ],
      pullUps: [{ reps: 10 }],
    });

    const stats = await myStats(athlete.bearer);
    expect(stats.items.map((x) => x.exerciseName).sort()).toEqual(["Klimmzüge", "Kniebeuge"]);
    const squatStats = stats.items.find((x) => x.exerciseId === squat.id)!;
    expect(squatStats).toMatchObject({
      metric: "estimated1rm",
      sessionCount: 2,
      lastDate: addDays(today, -3),
      best: {
        estimated1rm: { value: 122.5, date: addDays(today, -3) },
        topWeightKg: { value: 105 },
      },
      change: { from: 116.7, to: 122.5, fromDate: addDays(today, -7), percent: 5 },
    });
    expect(stats.records.map((x) => x.exerciseId)).toEqual([squat.id]);
    expect(stats.items.find((x) => x.exerciseId === pullUp.id)).toMatchObject({
      metric: "maxReps",
      best: { maxReps: { value: 10 }, estimated1rm: null },
    });

    const detail = await api()
      .get(`/api/v1/me/exercise-stats/${squat.id}`)
      .set("Authorization", athlete.bearer);
    expect(detail.status).toBe(200);
    const body = detail.body as ExerciseStatsDetail;
    expect(body.sessions.map((s) => [s.date, s.topWeightKg, s.volumeKg, s.setCount])).toEqual([
      [addDays(today, -7), 100, 1000, 2],
      [addDays(today, -3), 105, 525, 1],
    ]);
  });

  it("zählt laufende Trainings und ausgelassene Übungen nicht", async () => {
    const { athlete, dayId } = await setup();
    await train(athlete.bearer, dayId, today, {
      squat: [
        { weightKg: 60, reps: 5 },
        { weightKg: 200, reps: 5 },
      ],
      pullUps: [{ reps: 8 }],
      finish: false,
    });

    expect((await myStats(athlete.bearer)).items).toEqual([]);
  });

  it("meldet neue Bestwerte beim Abschließen, aber nicht beim ersten Mal", async () => {
    const { athlete, dayId, squat, pullUp } = await setup();
    const first = await train(athlete.bearer, dayId, addDays(today, -2), {
      squat: [
        { weightKg: 60, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
      pullUps: [{ reps: 8 }],
    });
    expect(first.status).toBe("completed");
    expect(first.newRecords).toEqual([]);

    const second = await train(athlete.bearer, dayId, today, {
      squat: [
        { weightKg: 60, reps: 5 },
        { weightKg: 105, reps: 3 },
      ],
      pullUps: [{ reps: 9 }],
    });

    // 105 × 3 = 115,5 geschätzt (weniger als 116,7), aber höheres Gewicht.
    expect(second.newRecords).toEqual([
      {
        exerciseId: squat.id,
        exerciseName: "Kniebeuge",
        kind: "topWeightKg",
        value: 105,
        previous: 100,
      },
      { exerciseId: pullUp.id, exerciseName: "Klimmzüge", kind: "maxReps", value: 9, previous: 8 },
    ]);
  });

  it("übernimmt Korrekturen an abgeschlossenen Trainings sofort", async () => {
    const { athlete, dayId, squat } = await setup();
    const log = await train(athlete.bearer, dayId, today, {
      squat: [
        { weightKg: 60, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
      pullUps: [{ reps: 8 }],
    });

    const corrected = await api()
      .put(`/api/v1/me/workout-logs/${log.id}`)
      .set("Authorization", athlete.bearer)
      .send({
        revision: log.revision,
        rating: null,
        notes: null,
        exercises: [
          {
            id: log.exercises[0]!.id,
            sets: [
              { weightKg: 60, reps: 5, done: true },
              { weightKg: 110, reps: 5, done: true },
            ],
          },
          { id: log.exercises[1]!.id, skipped: true, sets: [] },
        ],
      } satisfies UpdateWorkoutRequest);
    expect(corrected.status).toBe(200);

    const stats = await myStats(athlete.bearer);
    expect(stats.items.map((x) => x.exerciseId)).toEqual([squat.id]);
    expect(stats.items[0]!.best.topWeightKg).toMatchObject({ value: 110 });
  });

  it("berechnet fehlende Kennzahlen bestehender Trainings nach", async () => {
    const { athlete, dayId, squat } = await setup();
    await train(athlete.bearer, dayId, today, {
      squat: [
        { weightKg: 60, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
      pullUps: [{ reps: 8 }],
    });
    // Stand vor Einführung der gespeicherten Kennzahlen.
    await WorkoutLogModel.updateMany({}, { $unset: { stats: 1, statsVersion: 1 } });

    await backfillWorkoutStats();

    const stats = await myStats(athlete.bearer);
    expect(stats.items).toHaveLength(2);
    expect(stats.items.find((x) => x.exerciseId === squat.id)!.best.topWeightKg).toMatchObject({
      value: 100,
    });
    const stored = await WorkoutLogModel.findOne().lean();
    expect(stored!.statsVersion).toBe(WORKOUT_STATS_VERSION);
  });

  it("zeigt dem Coach den Fortschritt nur der eigenen Athleten", async () => {
    const { athlete, coach, athleteId, dayId, squat } = await setup();
    await train(athlete.bearer, dayId, today, {
      squat: [
        { weightKg: 60, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
      pullUps: [{ reps: 8 }],
    });

    const list = await api()
      .get(`/api/v1/athletes/${athleteId}/exercise-stats`)
      .set("Authorization", coach.bearer);
    expect(list.status).toBe(200);
    expect((list.body as ExerciseStatsListResponse).items).toHaveLength(2);
    const detail = await api()
      .get(`/api/v1/athletes/${athleteId}/exercise-stats/${squat.id}`)
      .set("Authorization", coach.bearer);
    expect((detail.body as ExerciseStatsDetail).sessions).toHaveLength(1);

    const other = await createAndLogin({ role: "coach" });
    const foreign = await api()
      .get(`/api/v1/athletes/${athleteId}/exercise-stats`)
      .set("Authorization", other.bearer);
    expect(foreign.status).toBe(404);
  });
});
