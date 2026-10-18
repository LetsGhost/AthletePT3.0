import type {
  AthleteDetail,
  AthletePermissions,
  CreateExerciseRequest,
  CreatePlanRequest,
  Exercise,
  ExerciseListResponse,
  MyPlanResponse,
  Plan,
  PlanListResponse,
} from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser } from "../../../test/helpers";
import { TrainingPlanVersionModel } from "../plans/plan.model";

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

/** Globale Übung, eigene Übung des Coaches, eine fremde und ein angemeldeter Athlet. */
async function setup() {
  const admin = await createAndLogin({ role: "sysadmin" });
  const squat = await createExercise(admin.bearer);
  const coach = await createAndLogin({ role: "coach" });
  const coachOwn = await createExercise(coach.bearer, { name: "Sled Push" });
  const otherCoach = await createAndLogin({ role: "coach" });
  const foreign = await createExercise(otherCoach.bearer, { name: "Geheimübung" });
  const athlete = await createAndLogin({ role: "athlete", coachId: coach.user._id });
  return { coach, athlete, athleteId: athlete.user.id as string, squat, coachOwn, foreign };
}

async function grant(
  coachBearer: string,
  athleteId: string,
  permissions: Partial<AthletePermissions>,
) {
  const res = await api()
    .patch(`/api/v1/athletes/${athleteId}`)
    .set("Authorization", coachBearer)
    .send({ permissions });
  expect(res.status).toBe(200);
  return res.body as AthleteDetail;
}

function planBody(exerciseIds: string[]): CreatePlanRequest {
  return {
    name: "Mein Plan",
    days: [
      {
        name: "Tag A",
        weekday: 2,
        warmup: [],
        exercises: exerciseIds.map((exerciseId) => ({
          exerciseId,
          sets: [{ kind: "working", repsMin: 8 }],
        })),
      },
    ],
  };
}

describe("Berechtigungen des Athleten", () => {
  it("sind standardmäßig aus und lassen sich einzeln setzen", async () => {
    const { coach, athlete, athleteId } = await setup();

    const before = await api()
      .get(`/api/v1/athletes/${athleteId}`)
      .set("Authorization", coach.bearer)
      .expect(200);
    expect((before.body as AthleteDetail).permissions).toEqual({ ownPlan: false, ownWeek: false });

    expect((await grant(coach.bearer, athleteId, { ownWeek: true })).permissions).toEqual({
      ownPlan: false,
      ownWeek: true,
    });
    expect((await grant(coach.bearer, athleteId, { ownPlan: true })).permissions).toEqual({
      ownPlan: true,
      ownWeek: true,
    });

    const mine = await api()
      .get("/api/v1/me/permissions")
      .set("Authorization", athlete.bearer)
      .expect(200);
    expect(mine.body).toEqual({ ownPlan: true, ownWeek: true });
  });

  it("können nur vom eigenen Coach geändert werden", async () => {
    const { athlete, athleteId } = await setup();
    const otherCoach = await createAndLogin({ role: "coach" });
    await api()
      .patch(`/api/v1/athletes/${athleteId}`)
      .set("Authorization", otherCoach.bearer)
      .send({ permissions: { ownPlan: true } })
      .expect(404);
    await api()
      .patch(`/api/v1/athletes/${athleteId}`)
      .set("Authorization", athlete.bearer)
      .send({ permissions: { ownPlan: true } })
      .expect(403);
  });
});

describe("Eigener Trainingsplan", () => {
  it("ist ohne Berechtigung gesperrt", async () => {
    const { athlete, athleteId, squat } = await setup();
    const list = await api()
      .get(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", athlete.bearer);
    expect(list.status).toBe(403);
    expect(list.body.code).toBe("permission_denied");

    await api()
      .post(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", athlete.bearer)
      .send(planBody([squat.id]))
      .expect(403);
    await api().get("/api/v1/exercises").set("Authorization", athlete.bearer).expect(403);
  });

  it("erlaubt Anlegen, Bearbeiten und Aktivieren mit dem Katalog des Coaches", async () => {
    const { coach, athlete, athleteId, squat, coachOwn, foreign } = await setup();
    await grant(coach.bearer, athleteId, { ownPlan: true });

    // Übungssuche: global und vom eigenen Coach, nicht von fremden Coaches.
    const search = await api()
      .get("/api/v1/exercises")
      .set("Authorization", athlete.bearer)
      .expect(200);
    const names = (search.body as ExerciseListResponse).items.map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining([squat.name, coachOwn.name]));
    expect(names).not.toContain(foreign.name);

    const rejected = await api()
      .post(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", athlete.bearer)
      .send(planBody([foreign.id]));
    expect(rejected.status).toBe(400);

    const created = await api()
      .post(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", athlete.bearer)
      .send(planBody([squat.id, coachOwn.id]))
      .expect(201);
    const plan = created.body as Plan;
    expect(plan).toMatchObject({ status: "draft", createdBy: "athlete" });
    expect(plan.exercises.every((x) => x.selectable)).toBe(true);

    await api()
      .post(`/api/v1/athletes/${athleteId}/plans/${plan.id}/activate`)
      .set("Authorization", athlete.bearer)
      .expect(200);
    const mine = await api().get("/api/v1/me/plan").set("Authorization", athlete.bearer);
    expect((mine.body as MyPlanResponse).plan?.id).toBe(plan.id);

    // Änderung am aktiven Plan sichert eine Version, ohne Coach als Urheber.
    const activePlan = (
      await api()
        .get(`/api/v1/athletes/${athleteId}/plans/${plan.id}`)
        .set("Authorization", athlete.bearer)
        .expect(200)
    ).body as Plan;
    await api()
      .put(`/api/v1/athletes/${athleteId}/plans/${plan.id}`)
      .set("Authorization", athlete.bearer)
      .send({ ...planBody([squat.id]), name: "Mein Plan v2", revision: activePlan.revision })
      .expect(200);
    const version = await TrainingPlanVersionModel.findOne({ planId: plan.id });
    expect(version?.replacedByCoachId).toBeNull();

    // Der Coach sieht den Plan mit Urheber.
    const coachList = await api()
      .get(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", coach.bearer)
      .expect(200);
    expect((coachList.body as PlanListResponse).items).toEqual([
      expect.objectContaining({ id: plan.id, name: "Mein Plan v2", createdBy: "athlete" }),
    ]);
  });

  it("gibt dem Athleten auch Zugriff auf die Pläne des Coaches", async () => {
    const { coach, athlete, athleteId, squat } = await setup();
    await grant(coach.bearer, athleteId, { ownPlan: true });
    const coachPlan = (
      await api()
        .post(`/api/v1/athletes/${athleteId}/plans`)
        .set("Authorization", coach.bearer)
        .send(planBody([squat.id]))
        .expect(201)
    ).body as Plan;
    expect(coachPlan.createdBy).toBe("coach");

    await api()
      .delete(`/api/v1/athletes/${athleteId}/plans/${coachPlan.id}`)
      .set("Authorization", athlete.bearer)
      .expect(204);
  });

  it("gilt nur für die eigenen Pläne", async () => {
    const { coach, athlete } = await setup();
    const other = await createUser({ role: "athlete", coachId: coach.user._id });
    await grant(coach.bearer, other.id as string, { ownPlan: true });
    await grant(coach.bearer, athlete.user.id as string, { ownPlan: true });

    await api()
      .get(`/api/v1/athletes/${other.id as string}/plans`)
      .set("Authorization", athlete.bearer)
      .expect(404);
  });

  it("wird mit dem Entzug der Berechtigung sofort gesperrt", async () => {
    const { coach, athlete, athleteId } = await setup();
    await grant(coach.bearer, athleteId, { ownPlan: true });
    await api()
      .get(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", athlete.bearer)
      .expect(200);
    await grant(coach.bearer, athleteId, { ownPlan: false });
    await api()
      .get(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", athlete.bearer)
      .expect(403);
  });
});

describe("Eigene Trainingswoche", () => {
  const activities = [null, "Laufen", null, null, null, "Fußball", null];

  it("erlaubt dem Athleten den Wochenplan nur mit Berechtigung", async () => {
    const { coach, athlete, athleteId } = await setup();
    const denied = await api()
      .put(`/api/v1/athletes/${athleteId}/weekly-activities`)
      .set("Authorization", athlete.bearer)
      .send({ activities });
    expect(denied.status).toBe(403);

    await grant(coach.bearer, athleteId, { ownWeek: true });
    await api()
      .put(`/api/v1/athletes/${athleteId}/weekly-activities`)
      .set("Authorization", athlete.bearer)
      .send({ activities })
      .expect(200);
    const week = await api().get("/api/v1/me/week").set("Authorization", athlete.bearer);
    expect(week.body.activities).toEqual(activities);

    // Die Wochen-Berechtigung öffnet keine Pläne.
    await api()
      .get(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", athlete.bearer)
      .expect(403);
  });
});
