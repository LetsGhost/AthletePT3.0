import type {
  CreateExerciseRequest,
  CreatePlanRequest,
  Exercise,
  MyPlanResponse,
  Plan,
  PlanListResponse,
  PlanTemplate,
  PlanVersion,
  PlanVersionListResponse,
} from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, login } from "../../../test/helpers";
import { UserModel } from "../users/user.model";
import { TrainingPlanModel, TrainingPlanVersionModel } from "./plan.model";

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

/** Sysadmin mit globalen Übungen, Coach mit einem Athleten. */
async function setup() {
  const admin = await createAndLogin({ role: "sysadmin" });
  const squat = await createExercise(admin.bearer);
  const bench = await createExercise(admin.bearer, {
    name: "Bankdrücken",
    primaryMuscles: ["chest"],
  });
  const bike = await createExercise(admin.bearer, {
    name: "Fahrradergometer",
    category: "cardio",
    equipment: "machine",
    primaryMuscles: ["quads"],
  });
  const coach = await createAndLogin({ role: "coach" });
  const athlete = await createUser({ role: "athlete", coachId: coach.user._id });
  return { admin, coach, athlete, athleteId: athlete.id as string, squat, bench, bike };
}

const sets = [
  { kind: "warmup", repsMin: 10, weightKg: 40 },
  { kind: "working", repsMin: 6, repsMax: 8, weightKg: 100, rir: 2 },
] as const;

function planBody(exercises: Exercise[], overrides: Partial<CreatePlanRequest> = {}) {
  return {
    name: "Block 1",
    days: [
      {
        name: "Tag A",
        weekday: 1,
        warmup: [{ name: "5 min Rad", details: "locker" }],
        exercises: exercises.map((x) => ({ exerciseId: x.id, restSeconds: 120, sets: [...sets] })),
      },
    ],
    ...overrides,
  } satisfies CreatePlanRequest;
}

async function createPlan(bearer: string, athleteId: string, body: CreatePlanRequest) {
  const res = await api()
    .post(`/api/v1/athletes/${athleteId}/plans`)
    .set("Authorization", bearer)
    .send(body);
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return res.body as Plan;
}

type PlanBody = CreatePlanRequest & { days: NonNullable<CreatePlanRequest["days"]> };

/** Schickt den Plan unverändert (mit IDs) zurück, optional mit Änderungen. */
function asUpdate(plan: Plan, change: (body: PlanBody) => void = () => {}) {
  const body: PlanBody = {
    name: plan.name,
    notes: plan.notes,
    days: plan.days.map((day) => ({
      id: day.id,
      name: day.name,
      weekday: day.weekday,
      warmup: day.warmup.map(({ id, exerciseId, name, details }) => ({
        id,
        exerciseId,
        name,
        details,
      })),
      exercises: day.exercises.map(({ id, exerciseId, restSeconds, notes, sets }) => ({
        id,
        exerciseId,
        restSeconds,
        notes,
        sets,
      })),
    })),
  };
  change(body);
  return { ...body, revision: plan.revision };
}

function put(bearer: string, plan: Plan, body: ReturnType<typeof asUpdate>) {
  return api()
    .put(`/api/v1/athletes/${plan.athleteId}/plans/${plan.id}`)
    .set("Authorization", bearer)
    .send(body);
}

function action(bearer: string, plan: Plan, name: "activate" | "archive") {
  return api()
    .post(`/api/v1/athletes/${plan.athleteId}/plans/${plan.id}/${name}`)
    .set("Authorization", bearer);
}

async function myPlan(bearer: string) {
  const res = await api().get("/api/v1/me/plan").set("Authorization", bearer);
  expect(res.status).toBe(200);
  return (res.body as MyPlanResponse).plan;
}

describe("Trainingspläne (Coach)", () => {
  it("legt einen Entwurf an: Namen und Typ setzt der Server, Sätze werden normalisiert", async () => {
    const { coach, athleteId, squat, bike } = await setup();

    const plan = await createPlan(coach.bearer, athleteId, {
      ...planBody([squat]),
      days: [
        {
          ...planBody([squat]).days[0]!,
          warmup: [{ exerciseId: bike.id, name: "egal", details: "5 min" }],
        },
      ],
    });

    expect(plan.status).toBe("draft");
    expect(plan.revision).toBe(0);
    expect(plan.type).toBe("LEGS");
    const day = plan.days[0]!;
    expect(day).toMatchObject({ name: "Tag A", weekday: 1, type: "LEGS" });
    expect(day.warmup[0]).toMatchObject({ exerciseId: bike.id, name: "Fahrradergometer" });
    expect(day.exercises[0]).toMatchObject({ exerciseId: squat.id, exerciseName: "Kniebeuge" });
    expect(day.exercises[0]!.sets[0]).toEqual({
      kind: "warmup",
      repsMin: 10,
      repsMax: 10,
      durationSeconds: null,
      weightKg: 40,
      rir: null,
    });
    expect(plan.exercises.map((x) => [x.name, x.selectable]).sort()).toEqual([
      ["Fahrradergometer", true],
      ["Kniebeuge", true],
    ]);
  });

  it("verweigert Pläne für fremde Athleten und fremde eigene Übungen", async () => {
    const { athleteId, squat } = await setup();
    const other = await createAndLogin({ role: "coach" });
    const foreign = await createExercise(other.bearer, { name: "Bens Geheimübung" });
    const coach = await createAndLogin({ role: "coach" });
    const ownAthlete = await createUser({ role: "athlete", coachId: coach.user._id });

    const res = await api()
      .post(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", other.bearer)
      .send(planBody([squat]));
    expect(res.status).toBe(404);

    const withForeign = await api()
      .post(`/api/v1/athletes/${ownAthlete.id}/plans`)
      .set("Authorization", coach.bearer)
      .send(planBody([foreign]));
    expect(withForeign.status).toBe(400);
    expect(withForeign.body.errors[0]).toMatchObject({
      path: "days.0.exercises.0.exerciseId",
      message: "Übung nicht gefunden",
    });
  });

  it("ist für Athleten gesperrt", async () => {
    const { athlete, athleteId } = await setup();
    const session = await login(athlete.email);
    const res = await api()
      .get(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", session.bearer);
    expect(res.status).toBe(403);
  });

  it("behält IDs beim Speichern und erkennt veraltete Stände (409)", async () => {
    const { coach, athleteId, squat, bench } = await setup();
    const plan = await createPlan(coach.bearer, athleteId, planBody([squat]));
    const dayId = plan.days[0]!.id;
    const entryId = plan.days[0]!.exercises[0]!.id;

    const res = await put(
      coach.bearer,
      plan,
      asUpdate(plan, (body) => {
        body.days[0]!.exercises!.push({
          exerciseId: bench.id,
          sets: [{ kind: "working", repsMin: 5 }],
        });
      }),
    );

    expect(res.status).toBe(200);
    const saved = res.body as Plan;
    expect(saved.revision).toBe(1);
    expect(saved.days[0]!.id).toBe(dayId);
    expect(saved.days[0]!.exercises.map((x) => x.id)[0]).toBe(entryId);
    expect(saved.days[0]!.exercises[1]!.exerciseName).toBe("Bankdrücken");
    // Kniebeuge und Bankdrücken: je 50 % Ober- und Unterkörper.
    expect(saved.type).toBe("FULLBODY");

    const stale = await put(coach.bearer, plan, asUpdate(plan));
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("plan_conflict");

    const unknownId = await put(
      coach.bearer,
      saved,
      asUpdate(saved, (body) => {
        body.days[0]!.id = "6acd3920c0072ec254663bd8";
      }),
    );
    expect(unknownId.status).toBe(400);
    expect(unknownId.body.errors[0].path).toBe("days.0.id");
  });

  it("aktiviert nur vollständige Pläne und archiviert dabei den bisher aktiven", async () => {
    const { coach, athleteId, squat } = await setup();
    const empty = await createPlan(coach.bearer, athleteId, { name: "Leer", days: [] });
    const incomplete = await action(coach.bearer, empty, "activate");
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.code).toBe("plan_incomplete");

    const first = await createPlan(coach.bearer, athleteId, planBody([squat]));
    const second = await createPlan(
      coach.bearer,
      athleteId,
      planBody([squat], { name: "Block 2" }),
    );
    expect((await action(coach.bearer, first, "activate")).body.status).toBe("active");
    const activated = await action(coach.bearer, second, "activate");

    expect(activated.status).toBe(200);
    expect(activated.body.status).toBe("active");
    const list = await api()
      .get(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", coach.bearer);
    expect((list.body as PlanListResponse).items.map((x) => [x.name, x.status])).toEqual([
      ["Block 2", "active"],
      ["Leer", "draft"],
      ["Block 1", "archived"],
    ]);
  });

  it("sichert vor jeder Änderung eines aktiven Plans den bisherigen Stand als Version", async () => {
    const { coach, athleteId, squat } = await setup();
    const draft = await createPlan(coach.bearer, athleteId, planBody([squat]));
    // Änderungen an Entwürfen erzeugen keine Version.
    const draftSaved = (await put(coach.bearer, draft, asUpdate(draft))).body as Plan;
    const active = (await action(coach.bearer, draftSaved, "activate")).body as Plan;

    const res = await put(
      coach.bearer,
      active,
      asUpdate(active, (body) => {
        body.name = "Block 1b";
      }),
    );
    expect(res.status).toBe(200);

    const base = `/api/v1/athletes/${athleteId}/plans/${active.id}/versions`;
    const versions = await api().get(base).set("Authorization", coach.bearer);
    expect((versions.body as PlanVersionListResponse).items).toEqual([
      expect.objectContaining({ revision: active.revision, name: "Block 1", dayCount: 1 }),
    ]);
    const version = await api()
      .get(`${base}/${active.revision}`)
      .set("Authorization", coach.bearer);
    expect((version.body as PlanVersion).days[0]!.exercises[0]!.exerciseName).toBe("Kniebeuge");

    // Ein aktiver Plan darf nicht leer gespeichert werden.
    const emptied = await put(
      coach.bearer,
      res.body as Plan,
      asUpdate(res.body as Plan, (body) => {
        body.days = [];
      }),
    );
    expect(emptied.status).toBe(400);
    expect(emptied.body.code).toBe("plan_incomplete");
  });

  it("löscht nur Entwürfe und lässt archivierte Pläne nicht bearbeiten", async () => {
    const { coach, athleteId, squat } = await setup();
    const plan = await createPlan(coach.bearer, athleteId, planBody([squat]));
    const archived = (await action(coach.bearer, plan, "archive")).body as Plan;
    expect(archived.status).toBe("archived");

    const edit = await put(coach.bearer, archived, asUpdate(archived));
    expect(edit.status).toBe(409);
    expect(edit.body.code).toBe("plan_archived");
    const remove = await api()
      .delete(`/api/v1/athletes/${athleteId}/plans/${plan.id}`)
      .set("Authorization", coach.bearer);
    expect(remove.status).toBe(409);
    expect(remove.body.code).toBe("plan_not_draft");

    const draft = await createPlan(coach.bearer, athleteId, planBody([squat]));
    const removeDraft = await api()
      .delete(`/api/v1/athletes/${athleteId}/plans/${draft.id}`)
      .set("Authorization", coach.bearer);
    expect(removeDraft.status).toBe(204);
  });

  it("behält archivierte Übungen im Plan, plant sie aber nicht neu ein", async () => {
    const { admin, coach, athleteId, squat, bench } = await setup();
    const plan = await createPlan(coach.bearer, athleteId, planBody([squat]));
    for (const x of [squat, bench]) {
      await api().post(`/api/v1/exercises/${x.id}/archive`).set("Authorization", admin.bearer);
    }

    const kept = await put(coach.bearer, plan, asUpdate(plan));
    expect(kept.status).toBe(200);
    expect((kept.body as Plan).exercises[0]).toMatchObject({ archived: true, selectable: false });

    const added = await put(
      coach.bearer,
      kept.body as Plan,
      asUpdate(kept.body as Plan, (body) => {
        body.days[0]!.exercises!.push({
          exerciseId: bench.id,
          sets: [{ kind: "working", repsMin: 5 }],
        });
      }),
    );
    expect(added.status).toBe(400);
    expect(added.body.errors[0].message).toContain("archiviert");
  });

  it("übernimmt Umbenennungen beim nächsten Speichern", async () => {
    const { admin, coach, athleteId, squat } = await setup();
    const plan = await createPlan(coach.bearer, athleteId, planBody([squat]));
    await api()
      .patch(`/api/v1/exercises/${squat.id}`)
      .set("Authorization", admin.bearer)
      .send({ name: "Back Squat" });

    const before = await api()
      .get(`/api/v1/athletes/${athleteId}/plans/${plan.id}`)
      .set("Authorization", coach.bearer);
    expect((before.body as Plan).days[0]!.exercises[0]!.exerciseName).toBe("Kniebeuge");
    const saved = (await put(coach.bearer, plan, asUpdate(plan))).body as Plan;
    expect(saved.days[0]!.exercises[0]!.exerciseName).toBe("Back Squat");
  });

  it("lässt den neuen Coach nach einem Wechsel weiterarbeiten, eigene Übungen des alten bleiben", async () => {
    const { coach, athlete, athleteId, squat } = await setup();
    const own = await createExercise(coach.bearer, { name: "Pause-Kniebeuge" });
    const plan = await createPlan(coach.bearer, athleteId, planBody([squat, own]));
    const newCoach = await createAndLogin({ role: "coach" });
    await UserModel.updateOne({ _id: athlete._id }, { coachId: newCoach.user._id });

    const old = await api()
      .get(`/api/v1/athletes/${athleteId}/plans/${plan.id}`)
      .set("Authorization", coach.bearer);
    expect(old.status).toBe(404);

    const read = await api()
      .get(`/api/v1/athletes/${athleteId}/plans/${plan.id}`)
      .set("Authorization", newCoach.bearer);
    expect(read.status).toBe(200);
    const info = (read.body as Plan).exercises.find((x) => x.id === own.id);
    expect(info).toMatchObject({ name: "Pause-Kniebeuge", selectable: false });

    const saved = await put(newCoach.bearer, read.body as Plan, asUpdate(read.body as Plan));
    expect(saved.status).toBe(200);
    expect((saved.body as Plan).days[0]!.exercises[1]!.exerciseName).toBe("Pause-Kniebeuge");
  });

  it("löscht Pläne und Versionen mit dem Athleten", async () => {
    const { coach, athleteId, squat } = await setup();
    const plan = await createPlan(coach.bearer, athleteId, planBody([squat]));
    const active = (await action(coach.bearer, plan, "activate")).body as Plan;
    await put(coach.bearer, active, asUpdate(active));

    const res = await api()
      .delete(`/api/v1/athletes/${athleteId}`)
      .set("Authorization", coach.bearer);

    expect(res.status).toBe(204);
    expect(await TrainingPlanModel.countDocuments({ athleteId })).toBe(0);
    expect(await TrainingPlanVersionModel.countDocuments({ athleteId })).toBe(0);
  });
});

describe("Eigener Plan (Athlet)", () => {
  it("zeigt nur den aktiven Plan, samt Details auch fremder und archivierter Übungen", async () => {
    const { admin, coach, athlete, athleteId, squat } = await setup();
    const session = await login(athlete.email);
    const own = await createExercise(coach.bearer, {
      name: "Pause-Kniebeuge",
      executionNotes: "2 Sekunden Pause unten",
    });

    expect(await myPlan(session.bearer)).toBeNull();
    const plan = await createPlan(coach.bearer, athleteId, planBody([squat, own]));
    expect(await myPlan(session.bearer)).toBeNull();

    await action(coach.bearer, plan, "activate");
    await api().post(`/api/v1/exercises/${squat.id}/archive`).set("Authorization", admin.bearer);
    const mine = await myPlan(session.bearer);

    expect(mine?.id).toBe(plan.id);
    expect(mine?.exercises.find((x) => x.id === own.id)).toMatchObject({
      executionNotes: "2 Sekunden Pause unten",
      selectable: false,
    });
    expect(mine?.exercises.find((x) => x.id === squat.id)?.archived).toBe(true);
  });

  it("ist für Coaches gesperrt", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const res = await api().get("/api/v1/me/plan").set("Authorization", coach.bearer);
    expect(res.status).toBe(403);
  });
});

describe("Planvorlagen", () => {
  it("legt Vorlagen an, die nur der eigene Coach sieht und bearbeitet", async () => {
    const { coach, squat } = await setup();
    const other = await createAndLogin({ role: "coach" });

    const created = await api()
      .post("/api/v1/plan-templates")
      .set("Authorization", coach.bearer)
      .send(planBody([squat], { name: "Grundkraft 3er-Split" }));
    expect(created.status).toBe(201);
    const template = created.body as PlanTemplate;
    expect(template.type).toBe("LEGS");

    const list = await api().get("/api/v1/plan-templates").set("Authorization", coach.bearer);
    expect(list.body.items).toEqual([
      expect.objectContaining({ name: "Grundkraft 3er-Split", dayCount: 1 }),
    ]);
    const foreignList = await api()
      .get("/api/v1/plan-templates")
      .set("Authorization", other.bearer);
    expect(foreignList.body.items).toEqual([]);
    const foreign = await api()
      .get(`/api/v1/plan-templates/${template.id}`)
      .set("Authorization", other.bearer);
    expect(foreign.status).toBe(404);

    const updated = await api()
      .put(`/api/v1/plan-templates/${template.id}`)
      .set("Authorization", coach.bearer)
      .send({ ...planBody([squat], { name: "Umbenannt" }), revision: template.revision });
    expect(updated.status).toBe(200);
    expect(updated.body.revision).toBe(1);
    const stale = await api()
      .put(`/api/v1/plan-templates/${template.id}`)
      .set("Authorization", coach.bearer)
      .send({ ...planBody([squat]), revision: template.revision });
    expect(stale.status).toBe(409);

    const removed = await api()
      .delete(`/api/v1/plan-templates/${template.id}`)
      .set("Authorization", coach.bearer);
    expect(removed.status).toBe(204);
  });
});
