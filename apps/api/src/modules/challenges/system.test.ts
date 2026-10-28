import {
  addDays,
  isoWeekOf,
  isoWeekStart,
  todayIsoDate,
  type BadgeListResponse,
  type ChallengeDetail,
  type ChallengeListResponse,
  type NotificationListResponse,
  type Plan,
  type SystemTemplate,
  type SystemTemplateListResponse,
  type UpdateWorkoutRequest,
  type WorkoutLog,
} from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, login } from "../../../test/helpers";
import { sentMails } from "../../lib/mail/mailer";
import { longestWeekStreak } from "./badge.service";
import { runChallengeJob } from "./challenge-job";
import { ChallengeModel } from "./challenge.model";
import { roundAt, roundTitle } from "./system.service";

describe("System-Runden (Berechnung)", () => {
  it("bildet Wochen, Monate und Titel", () => {
    expect(roundAt({ rhythm: "weekly", startDate: null, endDate: null }, "2026-10-28")).toEqual({
      startDate: "2026-10-26",
      endDate: "2026-11-01",
    });
    expect(roundAt({ rhythm: "monthly", startDate: null, endDate: null }, "2026-12-15")).toEqual({
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
    expect(roundTitle({ title: "Wochen-Volumen", rhythm: "weekly" }, "2026-10-26")).toBe(
      "Wochen-Volumen · KW 44",
    );
    expect(roundTitle({ title: "Konstanz", rhythm: "monthly" }, "2026-11-01")).toBe(
      "Konstanz · November",
    );
  });

  it("zählt die längste Wochenserie", () => {
    expect(
      longestWeekStreak(["2026-10-01", "2026-10-06", "2026-10-07", "2026-10-13", "2026-10-28"]),
    ).toBe(3);
    // Jahreswechsel: KW 53 2026 → KW 1 2027.
    expect(longestWeekStreak(["2026-12-28", "2027-01-05"])).toBe(2);
  });
});

describe("System-Challenges (API)", () => {
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
    const coachA = await createAndLogin({ role: "coach" });
    const coachB = await createAndLogin({ role: "coach" });
    const maxUser = await createUser({
      role: "athlete",
      coachId: coachA.user._id,
      name: "Max Muster",
    });
    const lenaUser = await createUser({
      role: "athlete",
      coachId: coachB.user._id,
      name: "Lena Beispiel",
    });
    const max = await login(maxUser.email);
    const lena = await login(lenaUser.email);
    const plan = await api()
      .post(`/api/v1/athletes/${maxUser.id as string}/plans`)
      .set("Authorization", coachA.bearer)
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
      .post(`/api/v1/athletes/${maxUser.id as string}/plans/${(plan.body as Plan).id}/activate`)
      .set("Authorization", coachA.bearer);
    return {
      admin,
      coachA,
      max,
      lena,
      maxId: maxUser.id as string,
      dayId: (activated.body as Plan).days[0]!.id,
    };
  }

  async function weeklyTemplate(bearer: string) {
    const res = await api()
      .post("/api/v1/admin/system-challenges")
      .set("Authorization", bearer)
      .send({
        title: "Wochen-Volumen",
        metric: "volume",
        tiers: [400, 1000, 2000],
        rhythm: "weekly",
        status: "active",
      });
    expect(res.status).toBe(201);
    return res.body as SystemTemplate;
  }

  async function setNickname(bearer: string, nickname: string) {
    return api()
      .put("/api/v1/me/challenge-settings")
      .set("Authorization", bearer)
      .send({ nickname });
  }

  async function completeWorkout(bearer: string, dayId: string) {
    const started = await api()
      .post("/api/v1/me/workout-logs")
      .set("Authorization", bearer)
      .send({ dayId, date: todayIsoDate() });
    await api()
      .post(`/api/v1/me/workout-logs/${started.body.id}/complete`)
      .set("Authorization", bearer)
      .send({
        revision: started.body.revision,
        rating: null,
        notes: null,
        exercises: (started.body as WorkoutLog).exercises.map((e) => ({
          id: e.id,
          sets: [{ weightKg: 100, reps: 5, done: true }],
        })),
      } satisfies UpdateWorkoutRequest);
  }

  it("legt Runden an, lässt mit Spitznamen beitreten und wertet global", async () => {
    const { admin, max, lena, dayId } = await setup();
    const template = await weeklyTemplate(admin.bearer);
    const monday = isoWeekStart(isoWeekOf(todayIsoDate()));
    expect(template.currentRound).toMatchObject({ startDate: monday, status: "running" });
    expect(template.nextRoundStart).toBe(addDays(monday, 7));
    expect(template.roundCount).toBe(2);

    const discover = await api()
      .get("/api/v1/me/challenges/discover")
      .set("Authorization", max.bearer);
    const rounds = (discover.body as ChallengeListResponse).items;
    expect(rounds.map((r) => [r.status, r.joined])).toEqual([
      ["running", false],
      ["planned", false],
    ]);
    const roundId = rounds[0]!.id;

    const withoutNickname = await api()
      .post(`/api/v1/me/challenges/${roundId}/join`)
      .set("Authorization", max.bearer);
    expect(withoutNickname.body.code).toBe("nickname_required");

    expect((await setNickname(max.bearer, "Max_M")).status).toBe(200);
    const taken = await setNickname(lena.bearer, "max_m");
    expect(taken.body.code).toBe("nickname_taken");
    const check = await api()
      .get("/api/v1/me/challenge-settings/nickname-check?nickname=MAX_M")
      .set("Authorization", lena.bearer);
    expect(check.body).toEqual({
      available: false,
      suggestions: ["Lena_B", "LenaLifts", expect.stringMatching(/^Lena_\d\d$/)],
    });
    await setNickname(lena.bearer, "Nordlicht");

    for (const athlete of [max, lena]) {
      const joined = await api()
        .post(`/api/v1/me/challenges/${roundId}/join`)
        .set("Authorization", athlete.bearer);
      expect(joined.status).toBe(200);
      expect(joined.body.joined).toBe(true);
    }
    await completeWorkout(max.bearer, dayId);

    const lenaView = await api()
      .get(`/api/v1/me/challenges/${roundId}`)
      .set("Authorization", lena.bearer);
    const body = lenaView.body as ChallengeDetail;
    // Fremde Teams erscheinen mit Spitznamen, Stufen nach Schwellen.
    expect(body.standings.map((s) => [s.name, s.score, s.tier])).toEqual([
      ["Max_M", 500, "bronze"],
      ["Lena Beispiel", 0, null],
    ]);
    expect(body.tiers).toEqual([400, 1000, 2000]);

    const left = await api()
      .post(`/api/v1/me/challenges/${roundId}/leave`)
      .set("Authorization", lena.bearer);
    expect(left.body).toMatchObject({ joined: false, participantCount: 1 });

    const list = await api()
      .get("/api/v1/admin/system-challenges")
      .set("Authorization", admin.bearer);
    const admins = list.body as SystemTemplateListResponse;
    expect(admins.activeParticipants).toBe(1);
    expect(admins.items[0]!.currentRound!.participantCount).toBe(1);
  });

  it("zeigt Abzeichen und meldet Ergebnisse mit Stufe, ohne Mail bei Abmeldung", async () => {
    const { admin, max, dayId } = await setup();
    await weeklyTemplate(admin.bearer);
    await setNickname(max.bearer, "Max_M");
    const discover = await api()
      .get("/api/v1/me/challenges/discover")
      .set("Authorization", max.bearer);
    const roundId = (discover.body as ChallengeListResponse).items[0]!.id;
    await api().post(`/api/v1/me/challenges/${roundId}/join`).set("Authorization", max.bearer);
    await completeWorkout(max.bearer, dayId);
    await completeWorkout(max.bearer, dayId);

    const badges = await api().get("/api/v1/me/badges").set("Authorization", max.bearer);
    const items = (badges.body as BadgeListResponse).items;
    expect(items.find((b) => b.id === `system:${roundId}`)).toMatchObject({
      tier: "silver",
      thresholds: ["0,4 t", "1 t", "2 t"],
      progress: "Silber · 1 t · Platz 1",
    });
    expect(items.find((b) => b.id === "streak")).toMatchObject({
      tier: null,
      progress: "Noch offen · 1 Woche am Stück",
    });

    await api()
      .put("/api/v1/me/challenge-settings")
      .set("Authorization", max.bearer)
      .send({ challengeMails: false });
    await ChallengeModel.updateOne(
      { _id: roundId },
      { startDate: addDays(todayIsoDate(), -7), endDate: addDays(todayIsoDate(), -1) },
    );
    sentMails.length = 0;
    await runChallengeJob();
    expect(sentMails).toHaveLength(0);
    const inbox = await api().get("/api/v1/me/notifications").set("Authorization", max.bearer);
    expect((inbox.body as NotificationListResponse).items[0]).toMatchObject({
      kind: "challenge_finished",
      text: "Platz 1 von 1",
    });
  });

  it("pausiert, ändert und löscht nur Entwürfe", async () => {
    const { admin, max } = await setup();
    const draft = await api()
      .post("/api/v1/admin/system-challenges")
      .set("Authorization", admin.bearer)
      .send({
        title: "Januar-Neustart",
        metric: "workouts",
        tiers: [6, 9, 12],
        rhythm: "once",
        startDate: addDays(todayIsoDate(), 10),
        endDate: addDays(todayIsoDate(), 40),
        status: "draft",
      });
    expect(draft.body).toMatchObject({ status: "draft", currentRound: null, roundCount: 0 });
    const invalidTiers = await api()
      .post("/api/v1/admin/system-challenges")
      .set("Authorization", admin.bearer)
      .send({
        title: "Falsch",
        metric: "workouts",
        tiers: [9, 6, 12],
        rhythm: "weekly",
        status: "draft",
      });
    expect(invalidTiers.status).toBe(400);

    const published = await api()
      .patch(`/api/v1/admin/system-challenges/${draft.body.id}`)
      .set("Authorization", admin.bearer)
      .send({ status: "active", tiers: [5, 8, 12] });
    expect(published.body).toMatchObject({ status: "active", roundCount: 1, nextRoundStart: null });
    expect(published.body.currentRound.status).toBe("planned");
    const round = await ChallengeModel.findById(published.body.currentRound.id).lean();
    expect(round).toMatchObject({ title: "Januar-Neustart", tiers: [5, 8, 12], goalValue: 5 });

    const remove = await api()
      .delete(`/api/v1/admin/system-challenges/${draft.body.id}`)
      .set("Authorization", admin.bearer);
    expect(remove.body.code).toBe("template_published");

    const forbidden = await api()
      .get("/api/v1/admin/system-challenges")
      .set("Authorization", max.bearer);
    expect(forbidden.status).toBe(403);
  });
});
