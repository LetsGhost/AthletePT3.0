import type {
  CreateExerciseRequest,
  CreatePlanRequest,
  Exercise,
  ExerciseListResponse,
  ExerciseNoticeListResponse,
  OwnedExerciseListResponse,
  Plan,
} from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin } from "../../../test/helpers";
import { UserModel } from "../users/user.model";
import { ExerciseNoticeModel } from "./exercise-notice.model";
import { ExerciseModel } from "./exercise.model";

const body = (overrides: Partial<CreateExerciseRequest> = {}): CreateExerciseRequest => ({
  name: "Bankdrücken",
  aliases: ["Bench Press"],
  category: "compound",
  equipment: "barbell",
  primaryMuscles: ["chest"],
  ...overrides,
});

async function create(bearer: string, overrides: Partial<CreateExerciseRequest> = {}) {
  const res = await api()
    .post("/api/v1/exercises")
    .set("Authorization", bearer)
    .send(body(overrides));
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return res.body as Exercise;
}

async function names(bearer: string, query: Record<string, string> = {}) {
  const res = await api().get("/api/v1/exercises").query(query).set("Authorization", bearer);
  expect(res.status).toBe(200);
  return (res.body as ExerciseListResponse).items.map((x) => x.name);
}

async function grantOwnPlan(coachBearer: string, athleteId: string, ownPlan = true) {
  await api()
    .patch(`/api/v1/athletes/${athleteId}`)
    .set("Authorization", coachBearer)
    .send({ permissions: { ownPlan } })
    .expect(200);
}

const post = (bearer: string, path: string) =>
  api().post(`/api/v1/exercises${path}`).set("Authorization", bearer);

async function athleteExercises(coachBearer: string) {
  const res = await api()
    .get("/api/v1/exercises/athlete-exercises")
    .set("Authorization", coachBearer)
    .expect(200);
  return (res.body as OwnedExerciseListResponse).items;
}

async function notices(bearer: string) {
  const res = await api().get("/api/v1/exercises/notices").set("Authorization", bearer).expect(200);
  return (res.body as ExerciseNoticeListResponse).items;
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

/** Globale Übung, Coach-Übung, zwei Athleten desselben Coaches mit eigenem Trainingsplan. */
async function setup() {
  const admin = await createAndLogin({ role: "sysadmin" });
  const coach = await createAndLogin({ role: "coach" });
  const global = await create(admin.bearer);
  const coachOwn = await create(coach.bearer, { name: "Sled Push", aliases: [] });
  const anna = await createAndLogin({ role: "athlete", coachId: coach.user._id, name: "Anna" });
  const ben = await createAndLogin({ role: "athlete", coachId: coach.user._id, name: "Ben" });
  const annaId = anna.user.id as string;
  const benId = ben.user.id as string;
  await grantOwnPlan(coach.bearer, annaId);
  await grantOwnPlan(coach.bearer, benId);
  return { admin, coach, global, coachOwn, anna, annaId, ben, benId };
}

describe("Private Übungen", () => {
  it("dürfen nur Athleten mit eigenem Trainingsplan und Coach anlegen", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const without = await createAndLogin({ role: "athlete", coachId: coach.user._id });
    const noCoach = await createAndLogin({ role: "athlete" });

    for (const athlete of [without, noCoach]) {
      const res = await api()
        .post("/api/v1/exercises")
        .set("Authorization", athlete.bearer)
        .send(body({ name: "Neu" }));
      expect(res.status).toBe(403);
    }
  });

  it("sieht nur der Athlet selbst, weder andere Athleten noch Coach oder Sysadmin", async () => {
    const { admin, coach, anna, ben } = await setup();

    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });

    expect(own.scope).toBe("private");
    expect(await names(anna.bearer, { scope: "private" })).toEqual(["Pistol Squat"]);
    expect(await names(anna.bearer)).toEqual(["Bankdrücken", "Pistol Squat", "Sled Push"]);
    for (const other of [ben, coach, admin]) {
      expect(await names(other.bearer)).not.toContain("Pistol Squat");
      await api().get(`/api/v1/exercises/${own.id}`).set("Authorization", other.bearer).expect(404);
    }
    // Auch ändern geht für niemanden sonst, selbst nicht für den Coach.
    for (const other of [ben, coach]) {
      await api()
        .patch(`/api/v1/exercises/${own.id}`)
        .set("Authorization", other.bearer)
        .send({ name: "Gekapert" })
        .expect(404);
    }
  });

  it("lässt nichts anlegen, was es im sichtbaren Katalog schon gibt", async () => {
    const { anna, ben } = await setup();
    await create(anna.bearer, { name: "Pistol Squat", aliases: ["Einbeinige Kniebeuge"] });

    const cases: [Partial<CreateExerciseRequest>, string][] = [
      [{ name: "Bankdrücken", aliases: [] }, "name"], // global, exakt
      [{ name: "  bankdruecken ", aliases: [] }, "name"], // andere Schreibweise
      [{ name: "Bench Press", aliases: [] }, "name"], // Synonym der globalen
      [{ name: "Brustpresse LH", aliases: ["Bankdrücken"] }, "aliases"], // Synonym = Name
      [{ name: "Brustpresse LH", aliases: ["bench press"] }, "aliases"], // Synonym = Synonym
      [{ name: "sled push", aliases: [] }, "name"], // Übung des Coaches
      [{ name: "Pistol Squat", aliases: [] }, "name"], // eigene private
      [{ name: "Einbeinige Kniebeuge", aliases: [] }, "name"], // Synonym der eigenen
    ];
    for (const [overrides, path] of cases) {
      const res = await api()
        .post("/api/v1/exercises")
        .set("Authorization", anna.bearer)
        .send(body(overrides));
      expect(res.status, JSON.stringify(overrides)).toBe(409);
      expect(res.body.code).toBe("exercise_exists");
      expect(res.body.errors[0].path).toBe(path);
    }

    // Ähnliche Namen sind erlaubt, ebenso die private Übung eines anderen Athleten (unsichtbar).
    await create(anna.bearer, { name: "Bankdrücken eng", aliases: [] });
    await create(ben.bearer, { name: "Pistol Squat", aliases: [] });
  });

  it("zählt archivierte Übungen nicht als vorhanden", async () => {
    const { admin, anna, global } = await setup();
    await post(admin.bearer, `/${global.id}/archive`).expect(200);

    expect((await create(anna.bearer)).scope).toBe("private");
  });

  it("darf der Athlet bearbeiten, archivieren und wiederherstellen, Katalogübungen nicht", async () => {
    const { coach, anna, global, coachOwn } = await setup();
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });

    const patched = await api()
      .patch(`/api/v1/exercises/${own.id}`)
      .set("Authorization", anna.bearer)
      .send({ name: "Pistol Squat (Box)", description: "Auf eine Box setzen" });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ name: "Pistol Squat (Box)", scope: "private" });

    // Umbenennen auf einen vorhandenen Namen oder ein vorhandenes Synonym ist gesperrt.
    for (const change of [{ name: "Sled Push" }, { aliases: ["Bench Press"] }]) {
      const res = await api()
        .patch(`/api/v1/exercises/${own.id}`)
        .set("Authorization", anna.bearer)
        .send(change);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("exercise_exists");
    }

    await post(anna.bearer, `/${own.id}/archive`).expect(200);
    expect(await names(anna.bearer, { scope: "private" })).toEqual([]);

    // Inzwischen hat der Coach die Übung angelegt: Wiederherstellen wäre ein Duplikat.
    const coachCopy = await create(coach.bearer, { name: "Pistol Squat (Box)", aliases: [] });
    const blocked = await post(anna.bearer, `/${own.id}/restore`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("exercise_exists");
    await post(coach.bearer, `/${coachCopy.id}/archive`).expect(200);
    await post(anna.bearer, `/${own.id}/restore`).expect(200);

    for (const id of [global.id, coachOwn.id]) {
      const res = await api()
        .patch(`/api/v1/exercises/${id}`)
        .set("Authorization", anna.bearer)
        .send({ name: "Gekapert" });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("exercise_readonly");
    }
  });

  it("kann der Athlet einplanen, andere Athleten und der Coach nicht neu", async () => {
    const { coach, anna, annaId, benId, ben, global } = await setup();
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });

    const created = await api()
      .post(`/api/v1/athletes/${annaId}/plans`)
      .set("Authorization", anna.bearer)
      .send(planBody([global.id, own.id]))
      .expect(201);
    const plan = created.body as Plan;
    expect(plan.exercises.find((x) => x.id === own.id)?.selectable).toBe(true);

    await api()
      .post(`/api/v1/athletes/${benId}/plans`)
      .set("Authorization", ben.bearer)
      .send(planBody([own.id]))
      .expect(400);
    await api()
      .post(`/api/v1/athletes/${annaId}/plans`)
      .set("Authorization", coach.bearer)
      .send(planBody([own.id]))
      .expect(400);
    await api()
      .post("/api/v1/plan-templates")
      .set("Authorization", coach.bearer)
      .send(planBody([own.id]))
      .expect((res) => expect([400, 404]).toContain(res.status));

    // Im bestehenden Plan sieht der Coach sie (nicht auswählbar) und kann weiter speichern.
    const read = await api()
      .get(`/api/v1/athletes/${annaId}/plans/${plan.id}`)
      .set("Authorization", coach.bearer)
      .expect(200);
    const forCoach = read.body as Plan;
    expect(forCoach.exercises.find((x) => x.id === own.id)).toMatchObject({
      name: "Pistol Squat",
      selectable: false,
    });
    const saved = await api()
      .put(`/api/v1/athletes/${annaId}/plans/${plan.id}`)
      .set("Authorization", coach.bearer)
      .send({ ...planBody([global.id, own.id]), revision: forCoach.revision })
      .expect(200);
    expect((saved.body as Plan).days[0]!.exercises[1]!.exerciseName).toBe("Pistol Squat");
  });

  it("bleiben nach Entzug der Berechtigung im Plan, neue gehen nicht mehr", async () => {
    const { coach, anna, annaId } = await setup();
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    const plan = (
      await api()
        .post(`/api/v1/athletes/${annaId}/plans`)
        .set("Authorization", anna.bearer)
        .send(planBody([own.id]))
        .expect(201)
    ).body as Plan;
    await api()
      .post(`/api/v1/athletes/${annaId}/plans/${plan.id}/activate`)
      .set("Authorization", anna.bearer)
      .expect(200);

    await grantOwnPlan(coach.bearer, annaId, false);

    await api()
      .post("/api/v1/exercises")
      .set("Authorization", anna.bearer)
      .send(body({ name: "Neu" }))
      .expect(403);
    const mine = await api().get("/api/v1/me/plan").set("Authorization", anna.bearer).expect(200);
    expect(mine.body.plan.exercises).toEqual([
      expect.objectContaining({ id: own.id, name: "Pistol Squat" }),
    ]);
  });

  it("werden mit dem Athleten gelöscht, übernommene bleiben beim Coach", async () => {
    const { coach, anna, annaId } = await setup();
    const kept = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    const removed = await create(anna.bearer, { name: "Nordic Curl", aliases: [] });
    await post(coach.bearer, `/${kept.id}/adopt`).expect(200);

    await api().delete(`/api/v1/athletes/${annaId}`).set("Authorization", coach.bearer).expect(204);

    expect(await ExerciseModel.exists({ _id: removed.id })).toBeNull();
    expect(await ExerciseModel.exists({ _id: kept.id })).not.toBeNull();
    expect(await ExerciseNoticeModel.countDocuments({ recipientId: annaId })).toBe(0);
  });
});

describe("Übernehmen durch den Coach", () => {
  it("listet die privaten Übungen seiner Athleten mit Namen", async () => {
    const { coach, anna, ben } = await setup();
    const otherCoach = await createAndLogin({ role: "coach" });
    await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    const archived = await create(ben.bearer, { name: "Nordic Curl", aliases: [] });
    await post(ben.bearer, `/${archived.id}/archive`).expect(200);

    const items = await athleteExercises(coach.bearer);

    expect(items.map((x) => [x.name, x.owner.name])).toEqual([["Pistol Squat", "Anna"]]);
    expect(await athleteExercises(otherCoach.bearer)).toEqual([]);
    await api()
      .get("/api/v1/exercises/athlete-exercises")
      .set("Authorization", anna.bearer)
      .expect(403);
  });

  it("verschiebt die Übung mit gleicher ID, der Athlet verliert das Bearbeitungsrecht", async () => {
    const { coach, anna, annaId, global } = await setup();
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    const plan = (
      await api()
        .post(`/api/v1/athletes/${annaId}/plans`)
        .set("Authorization", anna.bearer)
        .send(planBody([global.id, own.id]))
        .expect(201)
    ).body as Plan;

    const adopted = await post(coach.bearer, `/${own.id}/adopt`).expect(200);

    expect(adopted.body).toMatchObject({ id: own.id, scope: "own", name: "Pistol Squat" });
    expect(await athleteExercises(coach.bearer)).toEqual([]);
    expect(await names(coach.bearer, { scope: "own" })).toEqual(["Pistol Squat", "Sled Push"]);
    // Für den Athleten ist sie jetzt eine Übung seines Coaches.
    expect(await names(anna.bearer, { scope: "private" })).toEqual([]);
    const forAthlete = await api()
      .get(`/api/v1/exercises/${own.id}`)
      .set("Authorization", anna.bearer)
      .expect(200);
    expect(forAthlete.body.scope).toBe("own");
    const edit = await api()
      .patch(`/api/v1/exercises/${own.id}`)
      .set("Authorization", anna.bearer)
      .send({ name: "Meins" });
    expect(edit.status).toBe(403);
    expect(edit.body.code).toBe("exercise_readonly");
    // Der Coach darf jetzt bearbeiten und einplanen.
    await api()
      .patch(`/api/v1/exercises/${own.id}`)
      .set("Authorization", coach.bearer)
      .send({ executionNotes: "Langsam ablassen" })
      .expect(200);
    const read = (
      await api()
        .get(`/api/v1/athletes/${annaId}/plans/${plan.id}`)
        .set("Authorization", coach.bearer)
        .expect(200)
    ).body as Plan;
    expect(read.exercises.every((x) => x.selectable)).toBe(true);
    const forAnna = (
      await api()
        .get(`/api/v1/athletes/${annaId}/plans/${plan.id}`)
        .set("Authorization", anna.bearer)
        .expect(200)
    ).body as Plan;
    expect(forAnna.exercises.every((x) => x.selectable)).toBe(true);
  });

  it("gibt dem Athleten einen Hinweis, den nur er wegklicken kann", async () => {
    const { coach, anna, ben } = await setup();
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    await post(coach.bearer, `/${own.id}/adopt`).expect(200);

    const [notice] = await notices(anna.bearer);
    expect(notice).toMatchObject({
      kind: "adopted",
      exerciseId: own.id,
      exerciseName: "Pistol Squat",
    });
    expect(await notices(ben.bearer)).toEqual([]);

    await api()
      .delete(`/api/v1/exercises/notices/${notice!.id}`)
      .set("Authorization", ben.bearer)
      .expect(404);
    await api()
      .delete(`/api/v1/exercises/notices/${notice!.id}`)
      .set("Authorization", anna.bearer)
      .expect(204);
    expect(await notices(anna.bearer)).toEqual([]);
    await api()
      .delete(`/api/v1/exercises/notices/${notice!.id}`)
      .set("Authorization", anna.bearer)
      .expect(404);
  });

  it("sieht der Athlet den Hinweis auch ohne eigenen Trainingsplan", async () => {
    const { coach, anna, annaId } = await setup();
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    await grantOwnPlan(coach.bearer, annaId, false);
    await post(coach.bearer, `/${own.id}/adopt`).expect(200);

    expect(await notices(anna.bearer)).toHaveLength(1);
  });

  it("geht nur für aktive private Übungen der eigenen Athleten", async () => {
    const { coach, anna, global, coachOwn } = await setup();
    const otherCoach = await createAndLogin({ role: "coach" });
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    const archived = await create(anna.bearer, { name: "Nordic Curl", aliases: [] });
    await post(anna.bearer, `/${archived.id}/archive`).expect(200);

    await post(otherCoach.bearer, `/${own.id}/adopt`).expect(404);
    await post(anna.bearer, `/${own.id}/adopt`).expect(403);
    for (const id of [global.id, coachOwn.id, archived.id]) {
      await post(coach.bearer, `/${id}/adopt`).expect(404);
    }
    // Zweimal übernehmen: beim zweiten Mal ist sie nicht mehr privat.
    await post(coach.bearer, `/${own.id}/adopt`).expect(200);
    await post(coach.bearer, `/${own.id}/adopt`).expect(404);
  });

  it("scheitert verständlich, wenn der Name im Katalog schon vergeben ist", async () => {
    const { coach, anna, ben } = await setup();
    const fromAnna = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    const fromBen = await create(ben.bearer, { name: "pistol squat", aliases: [] });

    await post(coach.bearer, `/${fromAnna.id}/adopt`).expect(200);
    const conflict = await post(coach.bearer, `/${fromBen.id}/adopt`);

    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("exercise_name_taken");
    const stillPrivate = await api()
      .get(`/api/v1/exercises/${fromBen.id}`)
      .set("Authorization", ben.bearer)
      .expect(200);
    expect(stillPrivate.body.scope).toBe("private");
    expect(await notices(ben.bearer)).toEqual([]);
  });

  it("lässt private Übungen beim Coachwechsel mitziehen, übernommene bleiben beim alten", async () => {
    const { coach, anna, annaId } = await setup();
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });
    const adopted = await create(anna.bearer, { name: "Nordic Curl", aliases: [] });
    await post(coach.bearer, `/${adopted.id}/adopt`).expect(200);
    const plan = (
      await api()
        .post(`/api/v1/athletes/${annaId}/plans`)
        .set("Authorization", anna.bearer)
        .send(planBody([own.id, adopted.id]))
        .expect(201)
    ).body as Plan;
    const newCoach = await createAndLogin({ role: "coach" });

    await UserModel.updateOne({ _id: annaId }, { coachId: newCoach.user._id });

    expect(await athleteExercises(coach.bearer)).toEqual([]);
    expect((await athleteExercises(newCoach.bearer)).map((x) => x.name)).toEqual(["Pistol Squat"]);
    await post(newCoach.bearer, `/${adopted.id}/adopt`).expect(404);
    const forAnna = (
      await api()
        .get(`/api/v1/athletes/${annaId}/plans/${plan.id}`)
        .set("Authorization", anna.bearer)
        .expect(200)
    ).body as Plan;
    expect(Object.fromEntries(forAnna.exercises.map((x) => [x.name, x.selectable]))).toEqual({
      "Pistol Squat": true,
      "Nordic Curl": false,
    });
  });
});

describe("Vorschlag für den globalen Katalog", () => {
  it("reicht der Coach ein, der Sysadmin sieht ihn mit Coach und kann übernehmen", async () => {
    const { admin, coach, coachOwn } = await setup();
    const otherCoach = await createAndLogin({ role: "coach", name: "Carla" });

    const submitted = await post(coach.bearer, `/${coachOwn.id}/submit`).expect(200);
    expect(submitted.body.submitted).toBe(true);
    const list = await api()
      .get("/api/v1/exercises/submissions")
      .set("Authorization", admin.bearer)
      .expect(200);
    expect((list.body as OwnedExerciseListResponse).items).toEqual([
      expect.objectContaining({
        id: coachOwn.id,
        owner: { id: coach.user.id, name: coach.user.name },
      }),
    ]);
    expect(await names(otherCoach.bearer)).not.toContain("Sled Push");

    const published = await post(admin.bearer, `/${coachOwn.id}/publish`).expect(200);

    expect(published.body).toMatchObject({ id: coachOwn.id, scope: "global", submitted: false });
    expect(await names(otherCoach.bearer)).toContain("Sled Push");
    const edit = await api()
      .patch(`/api/v1/exercises/${coachOwn.id}`)
      .set("Authorization", coach.bearer)
      .send({ name: "Meins" });
    expect(edit.status).toBe(403);
    expect(edit.body.code).toBe("exercise_readonly");
    expect(await notices(coach.bearer)).toEqual([
      expect.objectContaining({ kind: "published", exerciseId: coachOwn.id }),
    ]);
    const after = await api()
      .get("/api/v1/exercises/submissions")
      .set("Authorization", admin.bearer);
    expect(after.body.items).toEqual([]);
  });

  it("lässt sich zurückziehen, Archivieren zieht ebenfalls zurück", async () => {
    const { admin, coach, coachOwn } = await setup();
    const second = await create(coach.bearer, { name: "Farmer's Walk", aliases: [] });
    await post(coach.bearer, `/${coachOwn.id}/submit`).expect(200);
    await post(coach.bearer, `/${second.id}/submit`).expect(200);

    expect((await post(coach.bearer, `/${coachOwn.id}/withdraw`).expect(200)).body.submitted).toBe(
      false,
    );
    expect((await post(coach.bearer, `/${second.id}/archive`).expect(200)).body.submitted).toBe(
      false,
    );
    const list = await api()
      .get("/api/v1/exercises/submissions")
      .set("Authorization", admin.bearer);
    expect(list.body.items).toEqual([]);
    await post(admin.bearer, `/${coachOwn.id}/publish`).expect(404);

    const archived = await post(coach.bearer, `/${second.id}/submit`);
    expect(archived.status).toBe(409);
    expect(archived.body.code).toBe("exercise_archived");
  });

  it("geht nur für eigene Übungen und nur durch Coach bzw. Sysadmin", async () => {
    const { admin, coach, global, coachOwn, anna } = await setup();
    const otherCoach = await createAndLogin({ role: "coach" });
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });

    await post(otherCoach.bearer, `/${coachOwn.id}/submit`).expect(404);
    await post(coach.bearer, `/${global.id}/submit`).expect(403);
    await post(coach.bearer, `/${own.id}/submit`).expect(404);
    await post(anna.bearer, `/${own.id}/submit`).expect(403);
    await post(coach.bearer, `/${coachOwn.id}/submit`).expect(200);
    await post(coach.bearer, `/${coachOwn.id}/publish`).expect(403);
    await api().get("/api/v1/exercises/submissions").set("Authorization", coach.bearer).expect(403);
    // Private Übungen kann der Sysadmin nie direkt übernehmen.
    await post(admin.bearer, `/${own.id}/publish`).expect(404);
  });

  it("scheitert verständlich, wenn der Name global schon vergeben ist", async () => {
    const { admin, coach } = await setup();
    const sameName = await create(coach.bearer, { name: "Bankdrücken", aliases: [] });
    await post(coach.bearer, `/${sameName.id}/submit`).expect(200);

    const conflict = await post(admin.bearer, `/${sameName.id}/publish`);

    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("exercise_name_taken");
    expect(await notices(coach.bearer)).toEqual([]);
  });

  it("führt den ganzen Weg vom Athleten bis in den globalen Katalog mit derselben ID", async () => {
    const { admin, coach, anna } = await setup();
    const own = await create(anna.bearer, { name: "Pistol Squat", aliases: [] });

    await post(coach.bearer, `/${own.id}/adopt`).expect(200);
    await post(coach.bearer, `/${own.id}/submit`).expect(200);
    await post(admin.bearer, `/${own.id}/publish`).expect(200);

    const stored = await ExerciseModel.findById(own.id).lean();
    expect(stored).toMatchObject({ ownerCoachId: null, ownerAthleteId: null, submittedAt: null });
    expect(await names(admin.bearer)).toContain("Pistol Squat");
  });
});
