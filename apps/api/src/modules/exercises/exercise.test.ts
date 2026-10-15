import type { CreateExerciseRequest, Exercise } from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin } from "../../../test/helpers";
import { seedExercises, seedGlobalExercises } from "./exercise-seed";
import { ExerciseModel } from "./exercise.model";

const base = (overrides: Partial<CreateExerciseRequest> = {}): CreateExerciseRequest => ({
  name: "Bankdrücken",
  aliases: ["Bench Press"],
  category: "compound",
  equipment: "barbell",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps", "front_delts"],
  ...overrides,
});

async function create(bearer: string, body: CreateExerciseRequest) {
  const res = await api().post("/api/v1/exercises").set("Authorization", bearer).send(body);
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return res.body as Exercise;
}

async function list(bearer: string, query: Record<string, string> = {}) {
  const res = await api().get("/api/v1/exercises").query(query).set("Authorization", bearer);
  expect(res.status).toBe(200);
  return res.body as { items: Exercise[]; total: number };
}

const names = (result: { items: Exercise[] }) => result.items.map((x) => x.name);

describe("Übungskatalog", () => {
  it("zeigt Coaches den Katalog und ihre eigenen Übungen, aber keine fremden", async () => {
    const admin = await createAndLogin({ role: "sysadmin" });
    const clara = await createAndLogin({ role: "coach" });
    const ben = await createAndLogin({ role: "coach" });
    await create(admin.bearer, base());
    await create(clara.bearer, base({ name: "Pause-Kniebeuge", primaryMuscles: ["quads"] }));
    const fremd = await create(ben.bearer, base({ name: "Bens Geheimübung" }));

    const result = await list(clara.bearer);

    expect(result.items.map((x) => [x.name, x.scope])).toEqual([
      ["Bankdrücken", "global"],
      ["Pause-Kniebeuge", "own"],
    ]);
    expect(names(await list(clara.bearer, { scope: "own" }))).toEqual(["Pause-Kniebeuge"]);
    expect(names(await list(clara.bearer, { scope: "global" }))).toEqual(["Bankdrücken"]);
    const direct = await api()
      .get(`/api/v1/exercises/${fremd.id}`)
      .set("Authorization", clara.bearer);
    expect(direct.status).toBe(404);
  });

  it("zeigt dem Sysadmin nur den globalen Katalog und legt dort an", async () => {
    const admin = await createAndLogin({ role: "sysadmin" });
    const coach = await createAndLogin({ role: "coach" });
    await create(coach.bearer, base({ name: "Eigene Übung" }));

    const created = await create(admin.bearer, base());

    expect(created.scope).toBe("global");
    expect(names(await list(admin.bearer))).toEqual(["Bankdrücken"]);
  });

  it("ist für Athleten gesperrt", async () => {
    const athlete = await createAndLogin({ role: "athlete" });
    const res = await api().get("/api/v1/exercises").set("Authorization", athlete.bearer);
    expect(res.status).toBe(403);
  });

  it("lässt Coaches globale Übungen nur lesen", async () => {
    const admin = await createAndLogin({ role: "sysadmin" });
    const coach = await createAndLogin({ role: "coach" });
    const global = await create(admin.bearer, base());

    const read = await api()
      .get(`/api/v1/exercises/${global.id}`)
      .set("Authorization", coach.bearer);
    expect(read.status).toBe(200);
    for (const req of [
      api().patch(`/api/v1/exercises/${global.id}`).send({ name: "Gekapert" }),
      api().post(`/api/v1/exercises/${global.id}/archive`),
    ]) {
      const res = await req.set("Authorization", coach.bearer);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("exercise_readonly");
    }
  });

  it("sucht in Name und Synonymen, unabhängig von Umlauten, Treffer am Anfang zuerst", async () => {
    const admin = await createAndLogin({ role: "sysadmin" });
    await create(admin.bearer, base());
    await create(admin.bearer, base({ name: "Kurzhantel-Bankdrücken", aliases: [] }));
    await create(admin.bearer, base({ name: "Schrägbankdrücken", aliases: ["Incline Press"] }));
    await create(
      admin.bearer,
      base({ name: "Kniebeuge", aliases: ["Squat"], primaryMuscles: ["quads"] }),
    );

    expect(names(await list(admin.bearer, { search: "bankdruecken" }))).toEqual([
      "Bankdrücken",
      "Kurzhantel-Bankdrücken",
      "Schrägbankdrücken",
    ]);
    expect(names(await list(admin.bearer, { search: "SQUAT" }))).toEqual(["Kniebeuge"]);
    // Sonderzeichen sind keine Regex: „k.*e“ würde sonst alles treffen.
    expect(names(await list(admin.bearer, { search: "k.*e" }))).toEqual([]);
  });

  it("filtert nach Muskelgruppe (primär oder sekundär), Equipment und Kategorie", async () => {
    const admin = await createAndLogin({ role: "sysadmin" });
    await create(admin.bearer, base());
    await create(
      admin.bearer,
      base({
        name: "Trizepsdrücken",
        equipment: "cable",
        category: "isolation",
        primaryMuscles: ["triceps"],
        secondaryMuscles: [],
      }),
    );
    await create(
      admin.bearer,
      base({ name: "Kniebeuge", primaryMuscles: ["quads"], secondaryMuscles: [] }),
    );

    expect(names(await list(admin.bearer, { muscle: "triceps" }))).toEqual([
      "Bankdrücken",
      "Trizepsdrücken",
    ]);
    expect(names(await list(admin.bearer, { equipment: "cable" }))).toEqual(["Trizepsdrücken"]);
    expect(names(await list(admin.bearer, { category: "compound", muscle: "quads" }))).toEqual([
      "Kniebeuge",
    ]);
  });

  it("blättert und liefert die Gesamtzahl", async () => {
    const admin = await createAndLogin({ role: "sysadmin" });
    for (const name of ["Alpha", "Beta", "Gamma"]) await create(admin.bearer, base({ name }));

    const page2 = await list(admin.bearer, { page: "2", pageSize: "2" });

    expect(page2).toMatchObject({ total: 3 });
    expect(names(page2)).toEqual(["Gamma"]);
  });

  it("verbietet doppelte Namen nur im eigenen Katalog", async () => {
    const admin = await createAndLogin({ role: "sysadmin" });
    const coach = await createAndLogin({ role: "coach" });
    await create(admin.bearer, base());

    // Gleicher Name wie global ist erlaubt.
    await create(coach.bearer, base());
    const again = await api()
      .post("/api/v1/exercises")
      .set("Authorization", coach.bearer)
      .send(base({ name: "  bankdruecken " }));

    expect(again.status).toBe(409);
    expect(again.body.code).toBe("exercise_name_taken");
    expect(again.body.errors[0].path).toBe("name");
  });

  it("prüft Muskelgruppen und Video-Link", async () => {
    const coach = await createAndLogin({ role: "coach" });

    const res = await api()
      .post("/api/v1/exercises")
      .set("Authorization", coach.bearer)
      .send(
        base({
          secondaryMuscles: ["chest"],
          videoUrl: "http://example.com/video",
          primaryMuscles: ["chest", "bizeps" as never],
        }),
      );

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual([
      "primaryMuscles.1",
      "videoUrl",
    ]);
  });

  it("bearbeitet eigene Übungen, ohne nicht mitgeschickte Felder zu leeren", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const own = await create(
      coach.bearer,
      base({ description: "Klassiker", videoUrl: "https://example.com/v" }),
    );

    const res = await api()
      .patch(`/api/v1/exercises/${own.id}`)
      .set("Authorization", coach.bearer)
      .send({ name: "Bankdrücken eng", aliases: ["Close Grip Bench"] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Bankdrücken eng",
      aliases: ["Close Grip Bench"],
      description: "Klassiker",
      videoUrl: "https://example.com/v",
      primaryMuscles: ["chest"],
    });
    expect(names(await list(coach.bearer, { search: "close grip" }))).toEqual(["Bankdrücken eng"]);
  });

  it("archiviert und stellt wieder her, archivierte fehlen in der normalen Liste", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const own = await create(coach.bearer, base());

    const archived = await api()
      .post(`/api/v1/exercises/${own.id}/archive`)
      .set("Authorization", coach.bearer);
    expect(archived.body.archived).toBe(true);
    expect(names(await list(coach.bearer))).toEqual([]);
    expect(names(await list(coach.bearer, { archived: "true" }))).toEqual(["Bankdrücken"]);

    // Name ist wieder frei; dann scheitert das Wiederherstellen verständlich.
    const replacement = await create(coach.bearer, base());
    const restore = await api()
      .post(`/api/v1/exercises/${own.id}/restore`)
      .set("Authorization", coach.bearer);
    expect(restore.status).toBe(409);
    expect(restore.body.code).toBe("exercise_name_taken");

    await api()
      .post(`/api/v1/exercises/${replacement.id}/archive`)
      .set("Authorization", coach.bearer);
    const restored = await api()
      .post(`/api/v1/exercises/${own.id}/restore`)
      .set("Authorization", coach.bearer);
    expect(restored.body.archived).toBe(false);
  });
});

describe("Startdaten", () => {
  it("legt die Grundübungen einmal an und lässt Änderungen des Sysadmins in Ruhe", async () => {
    expect(await seedGlobalExercises()).toBe(seedExercises.length);
    await ExerciseModel.updateOne({ seedKey: "bench-press" }, { name: "Bankdrücken (geändert)" });
    await ExerciseModel.updateOne({ seedKey: "plank" }, { archivedAt: new Date() });

    expect(await seedGlobalExercises()).toBe(0);
    expect(await ExerciseModel.countDocuments()).toBe(seedExercises.length);
    expect(await ExerciseModel.exists({ name: "Bankdrücken (geändert)" })).not.toBeNull();
  });

  it("hat eindeutige Schlüssel und Namen", () => {
    expect(new Set(seedExercises.map((x) => x.key)).size).toBe(seedExercises.length);
    expect(new Set(seedExercises.map((x) => x.name)).size).toBe(seedExercises.length);
    for (const x of seedExercises) {
      expect(x.primary.filter((m) => x.secondary.includes(m))).toEqual([]);
    }
  });
});
