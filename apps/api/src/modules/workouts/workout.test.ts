import {
  addDays,
  isoWeekOf,
  shiftIsoWeek,
  todayIsoDate,
  type CreateExerciseRequest,
  type CreatePlanRequest,
  type Exercise,
  type Plan,
  type UpdateWorkoutRequest,
  type WeekView,
  type WorkoutLog,
  type WorkoutLogListResponse,
} from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, login } from "../../../test/helpers";
import { WeeklyActivitiesModel, WorkoutLogModel } from "./workout-log.model";

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

function planBody(squat: Exercise, curl: Exercise): CreatePlanRequest {
  return {
    name: "Block 1",
    days: [
      {
        name: "Unterkörper",
        weekday: 1,
        exercises: [
          {
            exerciseId: squat.id,
            restSeconds: 180,
            notes: "Tief gehen",
            sets: [
              { kind: "warmup", repsMin: 8, weightKg: 60 },
              { kind: "working", repsMin: 5, repsMax: 6, weightKg: 100, rir: 2 },
              { kind: "working", repsMin: 5, repsMax: 6, weightKg: 100, rir: 2 },
            ],
          },
        ],
      },
      {
        name: "Arme",
        weekday: null,
        exercises: [{ exerciseId: curl.id, sets: [{ kind: "working", repsMin: 12 }] }],
      },
    ],
  };
}

async function createActivePlan(coachBearer: string, athleteId: string, body: CreatePlanRequest) {
  const created = await api()
    .post(`/api/v1/athletes/${athleteId}/plans`)
    .set("Authorization", coachBearer)
    .send(body);
  expect(created.status).toBe(201);
  const activated = await api()
    .post(`/api/v1/athletes/${athleteId}/plans/${(created.body as Plan).id}/activate`)
    .set("Authorization", coachBearer);
  expect(activated.status).toBe(200);
  return activated.body as Plan;
}

/** Coach mit Athlet und aktivem Plan (Tag „Unterkörper“ montags, Tag „Arme“ flexibel). */
async function setup() {
  const admin = await createAndLogin({ role: "sysadmin" });
  const squat = await createExercise(admin.bearer);
  const curl = await createExercise(admin.bearer, {
    name: "Bizepscurls",
    category: "isolation",
    equipment: "dumbbell",
    primaryMuscles: ["biceps"],
  });
  const coach = await createAndLogin({ role: "coach" });
  const athleteUser = await createUser({ role: "athlete", coachId: coach.user._id });
  const athlete = await login(athleteUser.email);
  const athleteId = athleteUser.id as string;
  const plan = await createActivePlan(coach.bearer, athleteId, planBody(squat, curl));
  const [legDay, armDay] = plan.days;
  return { admin, coach, athlete, athleteId, plan, legDay: legDay!, armDay: armDay!, squat, curl };
}

function start(bearer: string, body: { dayId: string; date?: string }) {
  return api().post("/api/v1/me/workout-logs").set("Authorization", bearer).send(body);
}

async function started(bearer: string, body: { dayId: string; date?: string }) {
  const res = await start(bearer, body);
  expect(res.status).toBe(201);
  return res.body as WorkoutLog;
}

/** Schickt das Protokoll unverändert zurück, optional mit Änderungen. */
function asUpdate(log: WorkoutLog, change: (body: UpdateWorkoutRequest) => void = () => {}) {
  const body: UpdateWorkoutRequest = {
    revision: log.revision,
    rating: log.rating,
    notes: log.notes,
    exercises: log.exercises.map((x) => ({
      id: x.id,
      skipped: x.skipped,
      notes: x.notes,
      sets: x.sets.map(({ weightKg, reps, durationSeconds, done }) => ({
        weightKg,
        reps,
        durationSeconds,
        done,
      })),
    })),
  };
  change(body);
  return body;
}

function put(bearer: string, log: WorkoutLog, body: UpdateWorkoutRequest) {
  return api().put(`/api/v1/me/workout-logs/${log.id}`).set("Authorization", bearer).send(body);
}

function complete(bearer: string, log: WorkoutLog, body = asUpdate(log)) {
  return api()
    .post(`/api/v1/me/workout-logs/${log.id}/complete`)
    .set("Authorization", bearer)
    .send(body);
}

function skip(bearer: string, body: { dayId: string; date?: string; notes?: string }) {
  return api().post("/api/v1/me/workout-logs/skip").set("Authorization", bearer).send(body);
}

async function myWeek(bearer: string, week?: string) {
  const res = await api()
    .get("/api/v1/me/week")
    .query(week ? { week } : {})
    .set("Authorization", bearer);
  expect(res.status).toBe(200);
  return res.body as WeekView;
}

/** Alle Sätze als erledigt markieren. */
const allDone = (body: UpdateWorkoutRequest) => {
  for (const exercise of body.exercises) for (const set of exercise.sets) set.done = true;
};

describe("Training starten", () => {
  it("legt ein laufendes Protokoll an, vorbefüllt mit den Vorgaben des Plans", async () => {
    const { athlete, athleteId, plan, legDay } = await setup();

    const log = await started(athlete.bearer, { dayId: legDay.id });

    expect(log).toMatchObject({
      athleteId,
      planId: plan.id,
      planRevision: plan.revision,
      dayId: legDay.id,
      dayName: "Unterkörper",
      dayType: "LEGS",
      date: todayIsoDate(),
      status: "in_progress",
      rating: null,
      completedAt: null,
      editableUntil: null,
      editable: true,
    });
    const [squat] = log.exercises;
    expect(squat).toMatchObject({
      planExerciseId: legDay.exercises[0]!.id,
      exerciseName: "Kniebeuge",
      restSeconds: 180,
      planNotes: "Tief gehen",
      skipped: false,
      previous: null,
    });
    expect(squat!.targets).toEqual(legDay.exercises[0]!.sets);
    expect(squat!.sets).toEqual([
      { kind: "warmup", weightKg: 60, reps: 8, durationSeconds: null, done: false },
      { kind: "working", weightKg: 100, reps: 6, durationSeconds: null, done: false },
      { kind: "working", weightKg: 100, reps: 6, durationSeconds: null, done: false },
    ]);
  });

  it("lässt nur ein laufendes Training gleichzeitig zu", async () => {
    const { athlete, legDay, armDay } = await setup();
    await started(athlete.bearer, { dayId: legDay.id });

    const res = await start(athlete.bearer, { dayId: armDay.id });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("workout_in_progress");
  });

  it("prüft Datum, Trainingstag und aktiven Plan", async () => {
    const { athlete, legDay } = await setup();
    const today = todayIsoDate();

    const future = await start(athlete.bearer, { dayId: legDay.id, date: addDays(today, 1) });
    expect(future.status).toBe(400);
    expect(future.body.errors).toEqual([
      { path: "date", message: "Das Datum liegt in der Zukunft" },
    ]);

    const tooOld = await start(athlete.bearer, { dayId: legDay.id, date: addDays(today, -15) });
    expect(tooOld.status).toBe(400);

    const unknownDay = await start(athlete.bearer, { dayId: "6acd3920c0072ec254663fff" });
    expect(unknownDay.status).toBe(404);

    const backfilled = await started(athlete.bearer, {
      dayId: legDay.id,
      date: addDays(today, -14),
    });
    expect(backfilled.date).toBe(addDays(today, -14));

    const other = await createAndLogin({ role: "athlete" });
    const noPlan = await start(other.bearer, { dayId: legDay.id });
    expect(noPlan.status).toBe(409);
    expect(noPlan.body.code).toBe("no_active_plan");
  });

  it("ist nur für Athleten", async () => {
    const { coach, legDay } = await setup();
    expect((await start(coach.bearer, { dayId: legDay.id })).status).toBe(403);
  });
});

describe("Zwischenspeichern und Abschließen", () => {
  it("speichert den ganzen Stand und erkennt Konflikte über die Revision", async () => {
    const { athlete, legDay } = await setup();
    const log = await started(athlete.bearer, { dayId: legDay.id });

    const saved = await put(
      athlete.bearer,
      log,
      asUpdate(log, (body) => {
        body.exercises[0]!.sets[0]!.done = true;
        body.exercises[0]!.sets[1] = { weightKg: 102.5, reps: 5, done: true };
        // Zusätzlicher Satz ohne Vorgabe.
        body.exercises[0]!.sets.push({ weightKg: 90, reps: 8, done: true });
        body.exercises[0]!.notes = "Knie zwickt";
        body.notes = "Gut geschlafen";
      }),
    );
    expect(saved.status).toBe(200);
    const updated = saved.body as WorkoutLog;
    expect(updated.revision).toBe(log.revision + 1);
    expect(updated.status).toBe("in_progress");
    expect(updated.notes).toBe("Gut geschlafen");
    expect(updated.exercises[0]!.notes).toBe("Knie zwickt");
    expect(updated.exercises[0]!.sets.map((s) => [s.kind, s.weightKg, s.reps, s.done])).toEqual([
      ["warmup", 60, 8, true],
      ["working", 102.5, 5, true],
      ["working", 100, 6, false],
      ["working", 90, 8, true],
    ]);

    const stale = await put(athlete.bearer, log, asUpdate(log));
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("workout_conflict");
  });

  it("lässt keine Übungen hinzufügen oder entfernen", async () => {
    const { athlete, legDay } = await setup();
    const log = await started(athlete.bearer, { dayId: legDay.id });

    const res = await put(
      athlete.bearer,
      log,
      asUpdate(log, (body) => {
        body.exercises = [];
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe("exercises");
  });

  it("schließt ab und erlaubt Korrekturen nur 7 Tage lang", async () => {
    const { athlete, legDay } = await setup();
    const log = await started(athlete.bearer, { dayId: legDay.id });

    const res = await complete(
      athlete.bearer,
      log,
      asUpdate(log, (body) => {
        allDone(body);
        body.rating = 8;
      }),
    );
    expect(res.status).toBe(200);
    const completed = res.body as WorkoutLog;
    expect(completed).toMatchObject({ status: "completed", rating: 8, editable: true });
    expect(completed.completedAt).not.toBeNull();
    expect(
      new Date(completed.editableUntil!).getTime() - new Date(completed.completedAt!).getTime(),
    ).toBe(7 * 86_400_000);

    const again = await complete(athlete.bearer, completed);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("workout_not_in_progress");

    const corrected = await put(
      athlete.bearer,
      completed,
      asUpdate(completed, (body) => {
        body.rating = 7;
      }),
    );
    expect(corrected.status).toBe(200);
    expect(corrected.body).toMatchObject({ status: "completed", rating: 7 });

    await WorkoutLogModel.updateOne(
      { _id: log.id },
      { completedAt: new Date(Date.now() - 8 * 86_400_000) },
    );
    const locked = await put(
      athlete.bearer,
      corrected.body as WorkoutLog,
      asUpdate(corrected.body as WorkoutLog),
    );
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe("workout_locked");
    const reloaded = await api()
      .get(`/api/v1/me/workout-logs/${log.id}`)
      .set("Authorization", athlete.bearer);
    expect(reloaded.body.editable).toBe(false);
  });

  it("zeigt beim nächsten Mal die zuletzt geschafften Sätze und übernimmt fehlende Gewichte", async () => {
    const { athlete, armDay } = await setup();
    const first = await started(athlete.bearer, {
      dayId: armDay.id,
      date: addDays(todayIsoDate(), -3),
    });
    expect(first.exercises[0]!.sets[0]!.weightKg).toBeNull();
    await complete(
      athlete.bearer,
      first,
      asUpdate(first, (body) => {
        body.exercises[0]!.sets[0] = { weightKg: 14, reps: 12, done: true };
      }),
    );

    const second = await started(athlete.bearer, { dayId: armDay.id });

    expect(second.exercises[0]!.previous).toEqual({
      date: addDays(todayIsoDate(), -3),
      sets: [{ kind: "working", weightKg: 14, reps: 12, durationSeconds: null, done: true }],
    });
    expect(second.exercises[0]!.sets[0]).toMatchObject({ weightKg: 14, reps: 12, done: false });
  });

  it("verwirft ein laufendes Training, abgeschlossene bleiben", async () => {
    const { athlete, legDay } = await setup();
    const log = await started(athlete.bearer, { dayId: legDay.id });

    const discarded = await api()
      .delete(`/api/v1/me/workout-logs/${log.id}`)
      .set("Authorization", athlete.bearer);
    expect(discarded.status).toBe(204);
    expect(await WorkoutLogModel.countDocuments()).toBe(0);

    const next = await started(athlete.bearer, { dayId: legDay.id });
    await complete(athlete.bearer, next);
    const res = await api()
      .delete(`/api/v1/me/workout-logs/${next.id}`)
      .set("Authorization", athlete.bearer);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("workout_completed");
  });

  it("verbirgt Trainings anderer Athleten", async () => {
    const { athlete, legDay } = await setup();
    const log = await started(athlete.bearer, { dayId: legDay.id });
    const other = await createAndLogin({ role: "athlete" });

    const res = await api()
      .get(`/api/v1/me/workout-logs/${log.id}`)
      .set("Authorization", other.bearer);
    expect(res.status).toBe(404);
    expect((await put(other.bearer, log, asUpdate(log))).status).toBe(404);
  });
});

describe("Training absagen", () => {
  it("sagt einen Tag einmal pro Woche ab und lässt die Absage zurücknehmen", async () => {
    const { athlete, legDay } = await setup();

    const res = await skip(athlete.bearer, { dayId: legDay.id, notes: "Krank" });
    expect(res.status).toBe(201);
    const skipped = res.body as WorkoutLog;
    expect(skipped).toMatchObject({ status: "skipped", notes: "Krank", exercises: [] });

    const twice = await skip(athlete.bearer, { dayId: legDay.id });
    expect(twice.status).toBe(409);
    expect(twice.body.code).toBe("workout_already_logged");

    const edit = await put(athlete.bearer, skipped, asUpdate(skipped));
    expect(edit.status).toBe(409);
    expect(edit.body.code).toBe("workout_skipped");

    const undo = await api()
      .delete(`/api/v1/me/workout-logs/${skipped.id}`)
      .set("Authorization", athlete.bearer);
    expect(undo.status).toBe(204);
    expect((await skip(athlete.bearer, { dayId: legDay.id })).status).toBe(201);
  });

  it("lässt einen in der Vorwoche abgesagten Tag diese Woche wieder absagen", async () => {
    const { athlete, legDay } = await setup();
    const lastWeek = addDays(todayIsoDate(), -7);
    expect((await skip(athlete.bearer, { dayId: legDay.id, date: lastWeek })).status).toBe(201);
    expect((await skip(athlete.bearer, { dayId: legDay.id })).status).toBe(201);
  });
});

describe("Wochenansicht", () => {
  it("berechnet den Status je Plantag aus den Protokollen der Woche", async () => {
    const { athlete, coach, athleteId, legDay, armDay } = await setup();
    await api()
      .put(`/api/v1/athletes/${athleteId}/weekly-activities`)
      .set("Authorization", coach.bearer)
      .send({ activities: [null, "Laufen", "", null, null, "  Fußball  ", null] })
      .expect(200);

    const empty = await myWeek(athlete.bearer);
    expect(empty).toMatchObject({
      week: isoWeekOf(todayIsoDate()),
      today: todayIsoDate(),
      completedCount: 0,
      plannedCount: 2,
      inProgress: null,
      activities: [null, "Laufen", null, null, null, "Fußball", null],
    });
    expect(empty.days.map((d) => [d.name, d.weekday, d.status])).toEqual([
      ["Unterkörper", 1, "open"],
      ["Arme", null, "open"],
    ]);

    const log = await started(athlete.bearer, { dayId: legDay.id });
    await skip(athlete.bearer, { dayId: armDay.id });
    const running = await myWeek(athlete.bearer);
    expect(running.days.map((d) => d.status)).toEqual(["in_progress", "skipped"]);
    expect(running.inProgress?.id).toBe(log.id);

    await complete(athlete.bearer, log, asUpdate(log, allDone));
    const done = await myWeek(athlete.bearer);
    expect(done.days.map((d) => d.status)).toEqual(["completed", "skipped"]);
    expect(done.days[0]!.logs[0]).toMatchObject({ id: log.id, doneSetCount: 3, exerciseCount: 1 });
    expect(done).toMatchObject({ completedCount: 1, inProgress: null });

    const previousWeek = await myWeek(athlete.bearer, shiftIsoWeek(done.week, -1));
    expect(previousWeek.days.map((d) => d.status)).toEqual(["open", "open"]);
  });

  it("zeigt Protokolle eines früheren Plans separat", async () => {
    const { athlete, coach, athleteId, legDay, squat, curl } = await setup();
    const log = await started(athlete.bearer, { dayId: legDay.id });
    await complete(athlete.bearer, log);
    await createActivePlan(coach.bearer, athleteId, { ...planBody(squat, curl), name: "Block 2" });

    const week = await myWeek(athlete.bearer);

    expect(week.plan?.name).toBe("Block 2");
    expect(week.days.map((d) => d.status)).toEqual(["open", "open"]);
    expect(week.otherLogs.map((l) => l.id)).toEqual([log.id]);
  });

  it("lehnt ungültige Wochen ab", async () => {
    const { athlete } = await setup();
    const res = await api()
      .get("/api/v1/me/week")
      .query({ week: "2027-W53" })
      .set("Authorization", athlete.bearer);
    expect(res.status).toBe(400);
  });
});

describe("Trainings für den Coach", () => {
  it("zeigt abgeschlossene und abgesagte Trainings, keine laufenden", async () => {
    const { athlete, coach, athleteId, legDay, armDay } = await setup();
    const first = await started(athlete.bearer, {
      dayId: legDay.id,
      date: addDays(todayIsoDate(), -1),
    });
    await complete(
      athlete.bearer,
      first,
      asUpdate(first, (body) => void (body.rating = 9)),
    );
    await skip(athlete.bearer, { dayId: armDay.id, notes: "Keine Zeit" });
    const running = await started(athlete.bearer, { dayId: legDay.id });

    const list = await api()
      .get(`/api/v1/athletes/${athleteId}/workout-logs`)
      .set("Authorization", coach.bearer);
    expect(list.status).toBe(200);
    const body = list.body as WorkoutLogListResponse;
    expect(body.total).toBe(2);
    expect(body.items.map((l) => [l.dayName, l.status, l.rating, l.notes])).toEqual([
      ["Arme", "skipped", null, "Keine Zeit"],
      ["Unterkörper", "completed", 9, null],
    ]);

    const detail = await api()
      .get(`/api/v1/athletes/${athleteId}/workout-logs/${first.id}`)
      .set("Authorization", coach.bearer);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id: first.id, editable: false, rating: 9 });

    const hidden = await api()
      .get(`/api/v1/athletes/${athleteId}/workout-logs/${running.id}`)
      .set("Authorization", coach.bearer);
    expect(hidden.status).toBe(404);

    const week = await api()
      .get(`/api/v1/athletes/${athleteId}/week`)
      .set("Authorization", coach.bearer);
    expect(week.status).toBe(200);
    expect((week.body as WeekView).inProgress).toBeNull();
    expect((week.body as WeekView).days[1]!.status).toBe("skipped");

    const mine = await api()
      .get("/api/v1/me/workout-logs")
      .query({ pageSize: 2 })
      .set("Authorization", athlete.bearer);
    expect((mine.body as WorkoutLogListResponse).total).toBe(3);
    expect((mine.body as WorkoutLogListResponse).items[0]!.id).toBe(running.id);
  });

  it("verbirgt Trainings und Woche fremder Athleten", async () => {
    const { athlete, athleteId, legDay } = await setup();
    const log = await started(athlete.bearer, { dayId: legDay.id });
    await complete(athlete.bearer, log);
    const otherCoach = await createAndLogin({ role: "coach" });

    for (const path of ["workout-logs", `workout-logs/${log.id}`, "week"]) {
      const res = await api()
        .get(`/api/v1/athletes/${athleteId}/${path}`)
        .set("Authorization", otherCoach.bearer);
      expect(res.status).toBe(404);
    }
    const put = await api()
      .put(`/api/v1/athletes/${athleteId}/weekly-activities`)
      .set("Authorization", otherCoach.bearer)
      .send({ activities: Array(7).fill(null) });
    expect(put.status).toBe(404);
  });

  it("verlangt genau sieben Einträge im Wochenplan", async () => {
    const { coach, athleteId } = await setup();
    const res = await api()
      .put(`/api/v1/athletes/${athleteId}/weekly-activities`)
      .set("Authorization", coach.bearer)
      .send({ activities: ["Laufen"] });
    expect(res.status).toBe(400);
  });

  it("löscht Trainings und Wochenplan mit dem Athleten", async () => {
    const { athlete, coach, athleteId, legDay } = await setup();
    await started(athlete.bearer, { dayId: legDay.id });
    await api()
      .put(`/api/v1/athletes/${athleteId}/weekly-activities`)
      .set("Authorization", coach.bearer)
      .send({ activities: ["Laufen", null, null, null, null, null, null] })
      .expect(200);

    await api()
      .delete(`/api/v1/athletes/${athleteId}`)
      .set("Authorization", coach.bearer)
      .expect(204);

    expect(await WorkoutLogModel.countDocuments({ athleteId })).toBe(0);
    expect(await WeeklyActivitiesModel.countDocuments({ athleteId })).toBe(0);
  });
});
