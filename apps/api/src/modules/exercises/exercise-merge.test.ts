import {
  addDays,
  todayIsoDate,
  type CreateExerciseRequest,
  type CreatePlanRequest,
  type Exercise,
  type ExerciseListResponse,
  type ExerciseNoticeListResponse,
  type ExerciseStatsListResponse,
  type OwnedExerciseListResponse,
  type Plan,
  type PlanTemplate,
  type UpdateWorkoutRequest,
  type WorkoutLog,
} from "@athletept/shared";
import { describe, expect, it, vi } from "vitest";

import { api, createAndLogin } from "../../../test/helpers";
import { TrainingPlanVersionModel } from "../plans/plan.model";
import { WorkoutLogModel } from "../workouts/workout-log.model";
import { ExerciseNoticeModel } from "./exercise-notice.model";
import { ExerciseModel } from "./exercise.model";

async function create(bearer: string, overrides: Partial<CreateExerciseRequest> = {}) {
  const res = await api()
    .post("/api/v1/exercises")
    .set("Authorization", bearer)
    .send({
      name: "Kniebeuge",
      category: "compound",
      equipment: "barbell",
      primaryMuscles: ["quads"],
      ...overrides,
    } satisfies CreateExerciseRequest);
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return res.body as Exercise;
}

const post = (bearer: string, path: string) =>
  api().post(`/api/v1/exercises${path}`).set("Authorization", bearer);

const replace = (bearer: string, id: string, targetId: string, reason?: string) =>
  post(bearer, `/${id}/replace`).send({ targetId, ...(reason !== undefined && { reason }) });

function planBody(exerciseIds: string[], warmupId?: string): CreatePlanRequest {
  return {
    name: "Mein Plan",
    days: [
      {
        name: "Tag A",
        warmup: warmupId ? [{ exerciseId: warmupId, name: "egal", details: "2 Runden" }] : [],
        exercises: exerciseIds.map((exerciseId) => ({
          exerciseId,
          sets: [
            { kind: "working", repsMin: 5 },
            { kind: "working", repsMin: 5 },
          ],
        })),
      },
    ],
  };
}

async function notices(bearer: string) {
  const res = await api().get("/api/v1/exercises/notices").set("Authorization", bearer).expect(200);
  return (res.body as ExerciseNoticeListResponse).items;
}

async function names(bearer: string, query: Record<string, string> = {}) {
  const res = await api().get("/api/v1/exercises").query(query).set("Authorization", bearer);
  expect(res.status).toBe(200);
  return (res.body as ExerciseListResponse).items.map((x) => x.name);
}

const today = todayIsoDate();

/** Globale Kniebeuge, Coach, Athletin Anna mit eigenem Trainingsplan und privater Übung. */
async function setup() {
  const admin = await createAndLogin({ role: "sysadmin" });
  const squat = await create(admin.bearer);
  const coach = await createAndLogin({ role: "coach" });
  const anna = await createAndLogin({ role: "athlete", coachId: coach.user._id, name: "Anna" });
  const annaId = anna.user.id as string;
  await api()
    .patch(`/api/v1/athletes/${annaId}`)
    .set("Authorization", coach.bearer)
    .send({ permissions: { ownPlan: true } })
    .expect(200);
  const own = await create(anna.bearer, { name: "Tiefe Hocke mit Hantel" });
  return { admin, squat, coach, anna, annaId, own };
}

async function createPlan(bearer: string, athleteId: string, body: CreatePlanRequest) {
  const res = await api()
    .post(`/api/v1/athletes/${athleteId}/plans`)
    .set("Authorization", bearer)
    .send(body)
    .expect(201);
  const plan = res.body as Plan;
  return (
    await api()
      .post(`/api/v1/athletes/${athleteId}/plans/${plan.id}/activate`)
      .set("Authorization", bearer)
      .expect(200)
  ).body as Plan;
}

async function getPlan(bearer: string, athleteId: string, planId: string) {
  return (
    await api()
      .get(`/api/v1/athletes/${athleteId}/plans/${planId}`)
      .set("Authorization", bearer)
      .expect(200)
  ).body as Plan;
}

/** Startet ein Training des ersten Tages; alle Sätze mit `weightKg` × 5, optional abgeschlossen. */
async function train(bearer: string, plan: Plan, date: string, weights: number[], finish = true) {
  const started = await api()
    .post("/api/v1/me/workout-logs")
    .set("Authorization", bearer)
    .send({ dayId: plan.days[0]!.id, date })
    .expect(201);
  const log = started.body as WorkoutLog;
  const body: UpdateWorkoutRequest = {
    revision: log.revision,
    rating: null,
    notes: null,
    exercises: log.exercises.map((x, i) => ({
      id: x.id,
      sets: x.sets.map(() => ({
        weightKg: weights[i]!,
        reps: 5,
        durationSeconds: null,
        done: true,
      })),
    })),
  };
  const path = `/api/v1/me/workout-logs/${log.id}`;
  const res = finish
    ? await api().post(`${path}/complete`).set("Authorization", bearer).send(body)
    : await api().put(path).set("Authorization", bearer).send(body);
  expect(res.status).toBe(200);
  return log.id;
}

describe("Ersetzen durch den Coach", () => {
  it("schreibt Pläne, Versionen und Protokolle um und führt die Statistik zusammen", async () => {
    const { squat, coach, anna, annaId, own } = await setup();
    const plan = await createPlan(anna.bearer, annaId, planBody([own.id, squat.id], own.id));
    // Änderung am aktiven Plan sichert eine Version, die die private Übung enthält.
    const updated = (
      await api()
        .put(`/api/v1/athletes/${annaId}/plans/${plan.id}`)
        .set("Authorization", anna.bearer)
        .send({
          ...planBody([own.id, squat.id], own.id),
          name: "Mein Plan v2",
          revision: plan.revision,
        })
        .expect(200)
    ).body as Plan;
    const both = await train(anna.bearer, updated, addDays(today, -3), [100, 80]);
    const running = await train(anna.bearer, updated, today, [110, 90], false);

    const res = await replace(coach.bearer, own.id, squat.id, "Das ist unsere Kniebeuge.");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: squat.id, name: "Kniebeuge" });

    const current = await getPlan(anna.bearer, annaId, plan.id);
    const day = current.days[0]!;
    expect(day.exercises.map((x) => [x.exerciseId, x.exerciseName])).toEqual([
      [squat.id, "Kniebeuge"],
      [squat.id, "Kniebeuge"],
    ]);
    expect(day.warmup[0]).toMatchObject({ exerciseId: squat.id, name: "Kniebeuge" });
    expect(current.exercises.map((x) => x.id)).toEqual([squat.id]);
    const version = await TrainingPlanVersionModel.findOne({ planId: plan.id }).lean();
    expect(version!.days[0]!.exercises.map((x) => x.exerciseId.toString())).toEqual([
      squat.id,
      squat.id,
    ]);

    const completed = await WorkoutLogModel.findById(both).lean();
    expect(completed!.exercises.map((x) => x.exerciseId?.toString())).toEqual([squat.id, squat.id]);
    // Beide Übungen zählen jetzt als eine: 4 Sätze, Bestwert aus der privaten Übung.
    expect(completed!.stats).toEqual([
      expect.objectContaining({ exerciseId: expect.anything(), setCount: 4, topWeightKg: 100 }),
    ]);
    expect(completed!.stats[0]!.exerciseId.toString()).toBe(squat.id);
    const inProgress = await WorkoutLogModel.findById(running).lean();
    expect(inProgress!.exercises[0]!.exerciseId?.toString()).toBe(squat.id);

    const stats = await api().get("/api/v1/me/exercise-stats").set("Authorization", anna.bearer);
    expect((stats.body as ExerciseStatsListResponse).items.map((x) => x.exerciseId)).toEqual([
      squat.id,
    ]);
  });

  it("archiviert die Quelle, sperrt sie und gibt dem Athleten einen Hinweis mit Begründung", async () => {
    const { squat, coach, anna, own } = await setup();

    await replace(coach.bearer, own.id, squat.id, "  Das ist unsere Kniebeuge.  ").expect(200);

    const stored = await ExerciseModel.findById(own.id).lean();
    expect(stored!.archivedAt).not.toBeNull();
    expect(stored!.mergedIntoId?.toString()).toBe(squat.id);
    expect(await names(anna.bearer, { scope: "private" })).toEqual([]);
    expect(await names(anna.bearer, { scope: "private", archived: "true" })).toEqual([]);
    const restore = await post(anna.bearer, `/${own.id}/restore`);
    expect(restore.status).toBe(409);
    expect(restore.body.code).toBe("exercise_merged");
    const edit = await api()
      .patch(`/api/v1/exercises/${own.id}`)
      .set("Authorization", anna.bearer)
      .send({ name: "Zurück" });
    expect(edit.body.code).toBe("exercise_merged");

    const list = await api()
      .get("/api/v1/exercises/athlete-exercises")
      .set("Authorization", coach.bearer);
    expect((list.body as OwnedExerciseListResponse).items).toEqual([]);
    expect(await notices(anna.bearer)).toEqual([
      expect.objectContaining({
        kind: "replaced",
        exerciseId: own.id,
        exerciseName: "Tiefe Hocke mit Hantel",
        replacementName: "Kniebeuge",
        reason: "Das ist unsere Kniebeuge.",
      }),
    ]);
  });

  it("leitet Speichern mit der alten ID still auf das Ziel um", async () => {
    const { squat, coach, anna, annaId, own } = await setup();
    const plan = await createPlan(anna.bearer, annaId, planBody([own.id]));
    // Der Editor wurde vor dem Ersetzen geöffnet und schickt noch die alte ID.
    const stale = await getPlan(anna.bearer, annaId, plan.id);

    await replace(coach.bearer, own.id, squat.id).expect(200);
    const saved = await api()
      .put(`/api/v1/athletes/${annaId}/plans/${plan.id}`)
      .set("Authorization", anna.bearer)
      .send({ ...planBody([own.id]), revision: stale.revision });

    expect(saved.status).toBe(200);
    expect((saved.body as Plan).days[0]!.exercises[0]).toMatchObject({
      exerciseId: squat.id,
      exerciseName: "Kniebeuge",
    });
    // Auch ein neuer Plan mit der alten ID landet beim Ziel.
    const fresh = await api()
      .post(`/api/v1/athletes/${annaId}/plans`)
      .set("Authorization", anna.bearer)
      .send(planBody([own.id]))
      .expect(201);
    expect((fresh.body as Plan).days[0]!.exercises[0]!.exerciseId).toBe(squat.id);
  });

  it("schließt ein laufendes Training nach dem Ersetzen mit den Kennzahlen des Ziels ab", async () => {
    const { squat, coach, anna, annaId, own } = await setup();
    const plan = await createPlan(anna.bearer, annaId, planBody([own.id]));
    const started = await api()
      .post("/api/v1/me/workout-logs")
      .set("Authorization", anna.bearer)
      .send({ dayId: plan.days[0]!.id, date: today })
      .expect(201);
    const log = started.body as WorkoutLog;

    await replace(coach.bearer, own.id, squat.id).expect(200);
    await api()
      .post(`/api/v1/me/workout-logs/${log.id}/complete`)
      .set("Authorization", anna.bearer)
      .send({
        revision: log.revision,
        rating: null,
        notes: null,
        exercises: log.exercises.map((x) => ({
          id: x.id,
          sets: x.sets.map(() => ({ weightKg: 60, reps: 5, durationSeconds: null, done: true })),
        })),
      } satisfies UpdateWorkoutRequest)
      .expect(200);

    const stored = await WorkoutLogModel.findById(log.id).lean();
    expect(stored!.stats.map((x) => x.exerciseId.toString())).toEqual([squat.id]);
  });

  it("erlaubt eigene Coach-Übungen als Ziel", async () => {
    const { coach, anna, own } = await setup();
    const coachOwn = await create(coach.bearer, { name: "Goblet Squat" });

    const res = await replace(coach.bearer, own.id, coachOwn.id);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(coachOwn.id);
    expect((await notices(anna.bearer))[0]).toMatchObject({
      replacementName: "Goblet Squat",
      reason: null,
    });
  });

  it("prüft Quelle und Ziel", async () => {
    const { admin, squat, coach, anna, own } = await setup();
    const otherCoach = await createAndLogin({ role: "coach" });
    const foreign = await create(otherCoach.bearer, { name: "Fremde Übung" });
    const archived = await create(admin.bearer, { name: "Alte Übung" });
    await post(admin.bearer, `/${archived.id}/archive`).expect(200);
    const secondPrivate = await create(anna.bearer, { name: "Noch eine private" });

    // Quelle: nur aktive private Übungen der eigenen Athleten.
    await replace(otherCoach.bearer, own.id, squat.id).expect(404);
    await replace(coach.bearer, squat.id, squat.id).expect(404);
    await replace(anna.bearer, own.id, squat.id).expect(403);
    // Ziel: aktiv, nicht privat, im Katalog des Coaches.
    for (const targetId of [own.id, foreign.id, archived.id, secondPrivate.id]) {
      const res = await replace(coach.bearer, own.id, targetId);
      expect(res.status, targetId).toBe(400);
      expect(res.body.errors[0].path).toBe("targetId");
    }
    // Nichts wurde angefasst.
    expect((await ExerciseModel.findById(own.id).lean())!.archivedAt).toBeNull();
    // Schon ersetzt: zweites Ersetzen findet die Quelle nicht mehr.
    await replace(coach.bearer, own.id, squat.id).expect(200);
    await replace(coach.bearer, own.id, squat.id).expect(404);
  });

  it("rollt bei einem Fehler alles zurück", async () => {
    const { squat, coach, anna, annaId, own } = await setup();
    const plan = await createPlan(anna.bearer, annaId, planBody([own.id]));
    const log = await train(anna.bearer, plan, addDays(today, -1), [100]);
    // Der letzte Schritt (Hinweis) scheitert, nachdem alles umgeschrieben wurde.
    const spy = vi.spyOn(ExerciseNoticeModel, "create").mockRejectedValueOnce(new Error("kaputt"));

    const res = await replace(coach.bearer, own.id, squat.id);
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect((await getPlan(anna.bearer, annaId, plan.id)).days[0]!.exercises[0]!.exerciseId).toBe(
      own.id,
    );
    const stored = await WorkoutLogModel.findById(log).lean();
    expect(stored!.exercises[0]!.exerciseId?.toString()).toBe(own.id);
    expect(stored!.stats[0]!.exerciseId.toString()).toBe(own.id);
    const source = await ExerciseModel.findById(own.id).lean();
    expect(source).toMatchObject({ archivedAt: null, mergedIntoId: null });
  });

  it("verweist beim Namenskonflikt aufs Ersetzen", async () => {
    const { coach, anna, own } = await setup();
    await create(coach.bearer, { name: "Tiefe Hocke mit Hantel" });
    // Der Athlet hatte seine Übung vorher angelegt; der Coach legt danach die gleiche an.
    const conflict = await post(coach.bearer, `/${own.id}/adopt`);

    expect(conflict.status).toBe(409);
    expect(conflict.body.detail).toMatch(/Ersetze die Übung stattdessen/);
    expect(await notices(anna.bearer)).toEqual([]);
  });
});

describe("Ersetzen durch den Sysadmin", () => {
  it("ersetzt eine vorgeschlagene Coach-Übung auch in Vorlagen und flacht Ketten ab", async () => {
    const { admin, squat, coach, anna, annaId, own } = await setup();
    const coachOwn = await create(coach.bearer, { name: "Goblet Squat" });
    // Erst ersetzt der Coach die private Übung durch seine, dann der Sysadmin seine durch global.
    const plan = await createPlan(anna.bearer, annaId, planBody([own.id]));
    const stale = await getPlan(anna.bearer, annaId, plan.id);
    await replace(coach.bearer, own.id, coachOwn.id).expect(200);
    const template = await api()
      .post("/api/v1/plan-templates")
      .set("Authorization", coach.bearer)
      .send(planBody([coachOwn.id]))
      .expect(201);
    await post(coach.bearer, `/${coachOwn.id}/submit`).expect(200);

    await replace(admin.bearer, coachOwn.id, squat.id, "Gibt es schon global.").expect(200);

    const storedTemplate = (
      await api()
        .get(`/api/v1/plan-templates/${(template.body as PlanTemplate).id}`)
        .set("Authorization", coach.bearer)
        .expect(200)
    ).body as PlanTemplate;
    expect(storedTemplate.days[0]!.exercises[0]!.exerciseId).toBe(squat.id);
    expect((await getPlan(anna.bearer, annaId, plan.id)).days[0]!.exercises[0]!.exerciseId).toBe(
      squat.id,
    );
    // Die erste Quelle zeigt jetzt direkt aufs globale Ziel.
    expect((await ExerciseModel.findById(own.id).lean())!.mergedIntoId?.toString()).toBe(squat.id);
    const saved = await api()
      .put(`/api/v1/athletes/${annaId}/plans/${plan.id}`)
      .set("Authorization", anna.bearer)
      .send({ ...planBody([own.id]), revision: stale.revision })
      .expect(200);
    expect((saved.body as Plan).days[0]!.exercises[0]!.exerciseId).toBe(squat.id);

    expect(await notices(coach.bearer)).toEqual([
      expect.objectContaining({
        kind: "replaced",
        exerciseName: "Goblet Squat",
        replacementName: "Kniebeuge",
        reason: "Gibt es schon global.",
      }),
    ]);
    const submissions = await api()
      .get("/api/v1/exercises/submissions")
      .set("Authorization", admin.bearer);
    expect(submissions.body.items).toEqual([]);
  });

  it("geht nur für vorgeschlagene Coach-Übungen und nur mit globalem Ziel", async () => {
    const { admin, squat, coach, own } = await setup();
    const notSubmitted = await create(coach.bearer, { name: "Goblet Squat" });
    const submitted = await create(coach.bearer, { name: "Zercher Squat" });
    await post(coach.bearer, `/${submitted.id}/submit`).expect(200);

    await replace(admin.bearer, notSubmitted.id, squat.id).expect(404);
    await replace(admin.bearer, own.id, squat.id).expect(404);
    await replace(admin.bearer, submitted.id, notSubmitted.id).expect(400);
    await replace(coach.bearer, submitted.id, squat.id).expect(404);
  });
});
