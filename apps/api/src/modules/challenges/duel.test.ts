import {
  addDays,
  todayIsoDate,
  type ChallengeDetail,
  type ChallengeListResponse,
  type CompleteWorkoutResponse,
  type NotificationListResponse,
  type Plan,
  type TeamDuelListResponse,
  type UpdateWorkoutRequest,
  type WorkoutLog,
} from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, login } from "../../../test/helpers";
import { sentMails } from "../../lib/mail/mailer";
import { runChallengeJob } from "./challenge-job";
import { ChallengeModel } from "./challenge.model";

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
  const coachA = await createAndLogin({ role: "coach", name: "Clara" });
  const coachB = await createAndLogin({ role: "coach", name: "Bernd" });
  const maxUser = await createUser({
    role: "athlete",
    coachId: coachA.user._id,
    name: "Max Muster",
    email: "max@example.com",
  });
  const lenaUser = await createUser({
    role: "athlete",
    coachId: coachB.user._id,
    name: "Lena Beispiel",
    email: "lena@example.com",
  });
  const max = await login(maxUser.email);
  const lena = await login(lenaUser.email);
  const maxId = maxUser.id as string;
  const plan = await api()
    .post(`/api/v1/athletes/${maxId}/plans`)
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
    .post(`/api/v1/athletes/${maxId}/plans/${(plan.body as Plan).id}/activate`)
    .set("Authorization", coachA.bearer);
  const lenaPlan = await api()
    .post(`/api/v1/athletes/${lenaUser.id as string}/plans`)
    .set("Authorization", coachB.bearer)
    .send({
      name: "Block L",
      days: [
        {
          name: "Tag L",
          exercises: [{ exerciseId: exercise.body.id, sets: [{ kind: "working", repsMin: 5 }] }],
        },
      ],
    });
  const lenaActivated = await api()
    .post(`/api/v1/athletes/${lenaUser.id as string}/plans/${(lenaPlan.body as Plan).id}/activate`)
    .set("Authorization", coachB.bearer);
  return {
    lenaDayId: (lenaActivated.body as Plan).days[0]!.id,
    coachA,
    coachB,
    max,
    lena,
    maxId,
    lenaId: lenaUser.id as string,
    exerciseId: exercise.body.id as string,
    dayId: (activated.body as Plan).days[0]!.id,
  };
}

async function challenge(bearer: string, email: string, durationDays = 7) {
  const res = await api()
    .post("/api/v1/me/duels")
    .set("Authorization", bearer)
    .send({ metric: "volume", durationDays, email });
  return res;
}

async function notifications(bearer: string) {
  const res = await api().get("/api/v1/me/notifications").set("Authorization", bearer);
  return res.body as NotificationListResponse;
}

async function completeWorkout(bearer: string, dayId: string) {
  const started = await api()
    .post("/api/v1/me/workout-logs")
    .set("Authorization", bearer)
    .send({ dayId, date: todayIsoDate() });
  const completed = await api()
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
  return completed.body as CompleteWorkoutResponse;
}

describe("Duelle", () => {
  it("lädt per E-Mail ein, startet bei Annahme und wertet über Coach-Grenzen", async () => {
    const { max, lena, lenaId, maxId, dayId, coachA, coachB } = await setup();
    const created = await challenge(max.bearer, " Lena@Example.com ");
    expect(created.status).toBe(201);
    const duel = created.body as ChallengeDetail;
    expect(duel).toMatchObject({ kind: "duel", status: "planned", title: "Meistes Volumen" });
    // Vor der Annahme verrät die Antwort nicht, wem die Adresse gehört.
    expect(duel.duel).toMatchObject({
      state: "pending",
      iAmChallenger: true,
      invitedEmail: "lena@example.com",
      opponentName: null,
    });
    expect(sentMails.map((m) => [m.to, m.subject])).toEqual([
      ["lena@example.com", "Max M. fordert dich zum Duell heraus"],
    ]);

    const inbox = await notifications(lena.bearer);
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.items[0]).toMatchObject({
      kind: "duel_invite",
      title: "Max M. fordert dich zum Duell",
      challengeId: duel.id,
      challengeKind: "duel",
    });

    const invitation = await api()
      .get(`/api/v1/me/challenges/${duel.id}`)
      .set("Authorization", lena.bearer);
    expect(invitation.body.duel).toMatchObject({ iAmChallenger: false, opponentName: "Max M." });

    // Ein offenes Duell zählt nicht, bevor es angenommen ist.
    const before = await completeWorkout(max.bearer, dayId);
    expect(before.challenges).toEqual([]);

    const accepted = await api()
      .post(`/api/v1/me/duels/${duel.id}/accept`)
      .set("Authorization", lena.bearer);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({
      status: "running",
      startDate: todayIsoDate(),
      endDate: addDays(todayIsoDate(), 6),
      participantCount: 2,
    });
    expect((await notifications(max.bearer)).items[0]).toMatchObject({
      kind: "duel_accepted",
      title: "Lena B. hat dein Duell angenommen",
    });

    // Training von heute zählt ab Annahme rückwirkend für den ganzen Tag.
    const mine = await api()
      .get(`/api/v1/me/challenges/${duel.id}`)
      .set("Authorization", max.bearer);
    const body = mine.body as ChallengeDetail;
    expect(body.duel).toMatchObject({ opponentName: "Lena B.", invitedEmail: null });
    expect(body.standings.map((s) => [s.name, s.score])).toEqual([
      ["Max Muster", 500],
      ["Lena B.", 0],
    ]);
    expect(body.daily).toEqual([{ athleteId: maxId, date: todayIsoDate(), value: 500 }]);

    // Coaches sehen die Duelle ihrer Athleten, fremde Athleten gekürzt.
    const teamA = await api()
      .get("/api/v1/coach/challenges/duels")
      .set("Authorization", coachA.bearer);
    expect((teamA.body as TeamDuelListResponse).items).toEqual([
      expect.objectContaining({
        athleteId: maxId,
        athleteName: "Max Muster",
        challenge: expect.objectContaining({
          duel: expect.objectContaining({ opponentName: "Lena B." }),
        }),
      }),
    ]);
    const teamB = await api()
      .get("/api/v1/coach/challenges/duels")
      .set("Authorization", coachB.bearer);
    expect((teamB.body as TeamDuelListResponse).items[0]).toMatchObject({
      athleteId: lenaId,
      challenge: { me: { name: "Lena Beispiel", score: 0 }, duel: { opponentName: "Max M." } },
    });
  });

  it("antwortet gleich, wenn zur Adresse kein Athlet gehört, und lässt die Einladung verfallen", async () => {
    const { max, coachB } = await setup();
    const unknown = await challenge(max.bearer, "niemand@example.com");
    const coach = await challenge(max.bearer, coachB.user.email);
    for (const res of [unknown, coach]) {
      expect(res.status).toBe(201);
      expect(res.body.duel).toMatchObject({ state: "pending", opponentName: null });
    }
    expect(sentMails).toHaveLength(0);

    const self = await challenge(max.bearer, "max@example.com");
    expect(self.body.code).toBe("duel_self");

    const later = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    expect(await runChallengeJob(later)).toEqual({ expired: 2 });
    const inbox = await notifications(max.bearer);
    expect(inbox.items.map((n) => [n.kind, n.text])).toEqual(
      expect.arrayContaining([
        ["duel_expired", "Meistes Volumen · niemand@example.com hat nicht reagiert"],
      ]),
    );
    // Verfallene Duelle verschwinden aus der Liste.
    const list = await api().get("/api/v1/me/challenges").set("Authorization", max.bearer);
    expect((list.body as ChallengeListResponse).items).toEqual([]);
  });

  it("begrenzt offene Duelle und erlaubt Ablehnen nur einmal", async () => {
    const { max, lena } = await setup();
    const first = await challenge(max.bearer, "lena@example.com");
    await challenge(max.bearer, "a@example.com");
    await challenge(max.bearer, "b@example.com");
    const fourth = await challenge(max.bearer, "c@example.com");
    expect(fourth.status).toBe(409);
    expect(fourth.body.code).toBe("duel_limit");

    const declined = await api()
      .post(`/api/v1/me/duels/${first.body.id}/decline`)
      .set("Authorization", lena.bearer);
    expect(declined.status).toBe(204);
    expect((await notifications(max.bearer)).items[0]).toMatchObject({
      kind: "duel_declined",
      title: "Lena B. hat abgelehnt",
    });
    const again = await api()
      .post(`/api/v1/me/duels/${first.body.id}/accept`)
      .set("Authorization", lena.bearer);
    expect(again.body.code).toBe("duel_not_pending");

    // Fremde können nicht antworten.
    const outsider = await createAndLogin({ role: "athlete" });
    const foreign = await api()
      .post(`/api/v1/me/duels/${first.body.id}/accept`)
      .set("Authorization", outsider.bearer);
    expect(foreign.status).toBe(404);
  });

  it("beendet beim Aufgeben, meldet Ergebnisse und bietet Revanche", async () => {
    const { max, lena, maxId, lenaId } = await setup();
    const created = await challenge(max.bearer, "lena@example.com");
    await api()
      .post(`/api/v1/me/duels/${created.body.id}/accept`)
      .set("Authorization", lena.bearer);

    const early = await api()
      .post(`/api/v1/me/duels/${created.body.id}/rematch`)
      .set("Authorization", max.bearer);
    expect(early.body.code).toBe("duel_not_finished");

    const gaveUp = await api()
      .post(`/api/v1/me/duels/${created.body.id}/give-up`)
      .set("Authorization", max.bearer);
    expect(gaveUp.status).toBe(200);
    const result = gaveUp.body as ChallengeDetail;
    expect(result).toMatchObject({ status: "finished", endedEarly: true });
    expect(result.duel!.gaveUpName).toBe("Max Muster");
    expect(result.standings.map((s) => [s.athleteId, s.rank, s.achieved])).toEqual([
      [lenaId, 1, true],
      [maxId, 2, false],
    ]);
    expect((await notifications(lena.bearer)).items[0]).toMatchObject({
      kind: "duel_gave_up",
      title: "Max M. hat aufgegeben",
    });
    // Das Ergebnis ist damit gemeldet, der Job schickt nichts mehr.
    await runChallengeJob();
    expect((await notifications(lena.bearer)).items).toHaveLength(2);

    const rematch = await api()
      .post(`/api/v1/me/duels/${created.body.id}/rematch`)
      .set("Authorization", max.bearer);
    expect(rematch.status).toBe(201);
    // Bei der Revanche ist der Gegner bekannt, seine Adresse bleibt verborgen.
    expect(rematch.body.duel).toMatchObject({
      state: "pending",
      opponentName: "Lena B.",
      invitedEmail: null,
    });
  });

  it("meldet, wer überholt wurde", async () => {
    const { max, lena, dayId, lenaDayId } = await setup();
    const created = await challenge(max.bearer, "lena@example.com");
    await api()
      .post(`/api/v1/me/duels/${created.body.id}/accept`)
      .set("Authorization", lena.bearer);
    await completeWorkout(lena.bearer, lenaDayId);
    const first = await completeWorkout(max.bearer, dayId);
    // Gleicher Wert, aber später erreicht: noch kein Überholen.
    expect(first.challenges[0]).toMatchObject({ rank: 2, previousRank: 2 });
    const second = await completeWorkout(max.bearer, dayId);
    expect(second.challenges[0]).toMatchObject({ rank: 1, previousRank: 2, score: 1000 });
    const overtaken = (await notifications(lena.bearer)).items.filter(
      (n) => n.kind === "challenge_overtaken",
    );
    expect(overtaken).toEqual([expect.objectContaining({ title: "Max M. hat dich überholt" })]);
  });

  it("meldet Ergebnisse beendeter Challenges einmal", async () => {
    const { max, lena } = await setup();
    const created = await challenge(max.bearer, "lena@example.com");
    await api()
      .post(`/api/v1/me/duels/${created.body.id}/accept`)
      .set("Authorization", lena.bearer);
    // Zurückdatieren: Das Duell lief bis gestern.
    await ChallengeModel.updateOne(
      { _id: created.body.id },
      { startDate: addDays(todayIsoDate(), -7), endDate: addDays(todayIsoDate(), -1) },
    );
    sentMails.length = 0;
    await runChallengeJob();
    await runChallengeJob();

    const maxInbox = await notifications(max.bearer);
    expect(maxInbox.items.filter((n) => n.kind === "challenge_finished")).toEqual([
      expect.objectContaining({
        title: "Duell gegen Lena B. beendet",
        text: "Meistes Volumen · 0 : 0",
      }),
    ]);
    expect(sentMails.map((m) => m.subject)).toEqual([
      "Ergebnis: Meistes Volumen",
      "Ergebnis: Meistes Volumen",
    ]);

    const read = await api()
      .post("/api/v1/me/notifications/read-all")
      .set("Authorization", max.bearer);
    expect(read.status).toBe(204);
    expect((await notifications(max.bearer)).unreadCount).toBe(0);
  });
});
