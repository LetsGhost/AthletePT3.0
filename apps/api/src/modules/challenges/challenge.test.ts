import {
  addDays,
  todayIsoDate,
  type ChallengeDetail,
  type ChallengeListResponse,
  type CompleteWorkoutResponse,
  type CreateCoachChallengeRequest,
  type Plan,
  type UpdateWorkoutRequest,
  type WorkoutLog,
} from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, login } from "../../../test/helpers";
import { sentMails } from "../../lib/mail/mailer";
import { computeStandings, type ScoreDefinition, type ScoreLog } from "./challenge-score";
import { ChallengeModel } from "./challenge.model";

const definition = (overrides: Partial<ScoreDefinition> = {}): ScoreDefinition => ({
  metric: "workouts",
  exerciseId: null,
  manualMode: null,
  dailyTarget: null,
  scoring: "ranking",
  goalValue: null,
  startDate: "2026-10-01",
  lastDate: "2026-10-31",
  finished: false,
  ...overrides,
});

let logCounter = 0;
function log(
  athleteId: string,
  date: string,
  stats: Partial<ScoreLog["stats"][number]>[] = [],
  time = "10:00",
): ScoreLog {
  logCounter += 1;
  return {
    id: `log${logCounter}`,
    athleteId,
    date,
    completedAt: new Date(`${date}T${time}:00+02:00`),
    stats: stats.map((s) => ({
      exerciseId: "squat",
      volumeKg: null,
      setCount: 0,
      estimated1rm: null,
      ...s,
    })),
  };
}

describe("Challenge-Wertung (Berechnung)", () => {
  it("zählt Trainings im Zeitraum, bei Gleichstand liegt vorn, wer früher dran war", () => {
    const logs = [
      log("anna", "2026-09-30"), // vor dem Start
      log("anna", "2026-10-02"),
      log("anna", "2026-10-05", [], "18:00"),
      log("ben", "2026-10-03"),
      log("ben", "2026-10-05", [], "09:00"),
      log("cleo", "2026-11-01"), // nach dem Ende
    ];
    const result = computeStandings(definition(), ["anna", "ben", "cleo"], logs, []);

    expect(result.standings).toEqual([
      { athleteId: "ben", score: 2, rank: 1, achieved: null },
      { athleteId: "anna", score: 2, rank: 2, achieved: null },
      { athleteId: "cleo", score: 0, rank: 3, achieved: null },
    ]);
    expect(result.teamScore).toBe(4);
  });

  it("zählt Trainingstage nur einmal je Tag", () => {
    const logs = [log("anna", "2026-10-02"), log("anna", "2026-10-02", [], "18:00")];
    const result = computeStandings(definition({ metric: "training_days" }), ["anna"], logs, []);
    expect(result.standings[0]!.score).toBe(1);
  });

  it("summiert Volumen und Sätze, optional nur für eine Übung", () => {
    const logs = [
      log("anna", "2026-10-02", [
        { exerciseId: "squat", volumeKg: 1000, setCount: 3 },
        { exerciseId: "bench", volumeKg: 500.5, setCount: 4 },
      ]),
      log("anna", "2026-10-04", [{ exerciseId: "squat", volumeKg: 1200, setCount: 3 }]),
    ];
    const volume = computeStandings(definition({ metric: "volume" }), ["anna"], logs, []);
    expect(volume.standings[0]!.score).toBe(2700.5);

    const squatSets = computeStandings(
      definition({ metric: "sets", exerciseId: "squat" }),
      ["anna"],
      logs,
      [],
    );
    expect(squatSets.standings[0]!.score).toBe(6);
  });

  it("nimmt beim e1RM den besten Wert der Übung", () => {
    const logs = [
      log("anna", "2026-10-02", [{ exerciseId: "squat", estimated1rm: 120 }]),
      log("anna", "2026-10-09", [{ exerciseId: "squat", estimated1rm: 115 }]),
      log("anna", "2026-10-09", [{ exerciseId: "bench", estimated1rm: 200 }]),
    ];
    const result = computeStandings(
      definition({ metric: "e1rm", exerciseId: "squat" }),
      ["anna"],
      logs,
      [],
    );
    expect(result.standings[0]!.score).toBe(120);
  });

  it("wertet freie Vorgaben nach Tagen mit erreichtem Tagesziel", () => {
    const at = new Date("2026-10-05T20:00:00Z");
    const entries = [
      { athleteId: "anna", date: "2026-10-02", value: 100, updatedAt: at },
      { athleteId: "anna", date: "2026-10-03", value: 64, updatedAt: at },
      { athleteId: "anna", date: "2026-10-04", value: 120, updatedAt: at },
    ];
    const result = computeStandings(
      definition({
        metric: "manual",
        manualMode: "quantity",
        dailyTarget: 100,
        scoring: "goal",
        goalValue: 2,
      }),
      ["anna"],
      [],
      entries,
    );
    expect(result.standings[0]).toMatchObject({ score: 2, achieved: true });
  });

  it("entscheidet Ziele erst am Ende, die Rangliste kürt Platz 1", () => {
    const logs = [log("anna", "2026-10-02"), log("anna", "2026-10-03"), log("ben", "2026-10-02")];
    const open = computeStandings(
      definition({ scoring: "goal", goalValue: 2 }),
      ["anna", "ben"],
      logs,
      [],
    );
    expect(open.standings.map((s) => s.achieved)).toEqual([true, null]);

    const finished = computeStandings(
      definition({ scoring: "goal", goalValue: 2, finished: true }),
      ["anna", "ben"],
      logs,
      [],
    );
    expect(finished.standings.map((s) => s.achieved)).toEqual([true, false]);

    const team = computeStandings(
      definition({ scoring: "team_goal", goalValue: 3 }),
      ["anna", "ben"],
      logs,
      [],
    );
    expect(team.standings.every((s) => s.achieved)).toBe(true);

    const ranking = computeStandings(definition({ finished: true }), ["anna", "ben"], logs, []);
    expect(ranking.standings.map((s) => s.achieved)).toEqual([true, false]);
  });
});

describe("Challenges (API)", () => {
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
    const coach = await createAndLogin({ role: "coach", name: "Clara" });
    const athleteUser = await createUser({ role: "athlete", coachId: coach.user._id, name: "Max" });
    const teammate = await createUser({ role: "athlete", coachId: coach.user._id, name: "Lena" });
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
    return {
      coach,
      athlete,
      athleteId,
      teammateId: teammate.id as string,
      exerciseId: exercise.body.id as string,
      dayId: (activated.body as Plan).days[0]!.id,
    };
  }

  const today = () => todayIsoDate();

  function challenge(
    participantIds: string[],
    overrides: Partial<CreateCoachChallengeRequest> = {},
  ): CreateCoachChallengeRequest {
    return {
      title: "Team-Volumen",
      metric: "volume",
      scoring: "ranking",
      startDate: today(),
      endDate: addDays(today(), 13),
      participantIds,
      prize: "Gratis-Session",
      ...overrides,
    };
  }

  async function completeWorkout(bearer: string, dayId: string) {
    const started = await api()
      .post("/api/v1/me/workout-logs")
      .set("Authorization", bearer)
      .send({ dayId, date: today() });
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
    expect(completed.status).toBe(200);
    return completed.body as CompleteWorkoutResponse;
  }

  it("legt eine Challenge an, benachrichtigt und wertet abgeschlossene Trainings", async () => {
    const { coach, athlete, athleteId, teammateId, dayId } = await setup();
    const created = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId, teammateId]));
    expect(created.status).toBe(201);
    const detail = created.body as ChallengeDetail;
    expect(detail).toMatchObject({
      status: "running",
      ownerName: "Clara",
      participantCount: 2,
      teamScore: 0,
    });
    expect(sentMails.map((m) => m.subject)).toEqual([
      "Neue Challenge: Team-Volumen",
      "Neue Challenge: Team-Volumen",
    ]);

    const completed = await completeWorkout(athlete.bearer, dayId);
    expect(completed.challenges).toEqual([
      expect.objectContaining({
        id: detail.id,
        gained: 500,
        score: 500,
        rank: 1,
        previousRank: 1,
        participantCount: 2,
        entryPending: false,
      }),
    ]);

    const mine = await api()
      .get(`/api/v1/me/challenges/${detail.id}`)
      .set("Authorization", athlete.bearer);
    expect(mine.status).toBe(200);
    const body = mine.body as ChallengeDetail;
    expect(body.me).toMatchObject({ name: "Max", score: 500, rank: 1, isMe: true });
    expect(body.standings.map((s) => [s.name, s.score, s.rank])).toEqual([
      ["Max", 500, 1],
      ["Lena", 0, 2],
    ]);

    const list = await api().get("/api/v1/me/challenges").set("Authorization", athlete.bearer);
    expect((list.body as ChallengeListResponse).items).toHaveLength(1);

    const coachView = await api()
      .get(`/api/v1/athletes/${athleteId}/challenges`)
      .set("Authorization", coach.bearer);
    expect((coachView.body as ChallengeListResponse).items[0]!.me).toMatchObject({ score: 500 });
  });

  it("prüft Teilnehmer, Übung und Zeitraum", async () => {
    const { coach, athleteId } = await setup();
    const foreign = await createUser({ role: "athlete" });
    const notMine = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId, foreign.id as string]));
    expect(notMine.status).toBe(400);
    expect(notMine.body.code).toBe("invalid_participants");

    const past = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId], { startDate: addDays(today(), -1) }));
    expect(past.body.code).toBe("start_in_past");

    const noExercise = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId], { metric: "e1rm" }));
    expect(noExercise.status).toBe(400);

    const tooLong = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId], { endDate: addDays(today(), 100) }));
    expect(tooLong.status).toBe(400);

    const noGoal = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId], { scoring: "goal" }));
    expect(noGoal.status).toBe(400);
  });

  it("nimmt Einträge einer freien Vorgabe nur für heute an", async () => {
    const { coach, athlete, athleteId, dayId } = await setup();
    const created = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(
        challenge([athleteId], {
          title: "100 Klimmzüge am Tag",
          metric: "manual",
          manualMode: "quantity",
          dailyTarget: 100,
          scoring: "goal",
          goalValue: 5,
        }),
      );
    expect(created.status).toBe(201);
    const id = (created.body as ChallengeDetail).id;

    // Nach dem Training erinnert der Abschluss ans Eintragen.
    const completed = await completeWorkout(athlete.bearer, dayId);
    expect(completed.challenges).toEqual([expect.objectContaining({ id, entryPending: true })]);

    const entry = await api()
      .put(`/api/v1/me/challenges/${id}/entries/${today()}`)
      .set("Authorization", athlete.bearer)
      .send({ value: 64 });
    expect(entry.status).toBe(200);
    expect(entry.body).toMatchObject({ todayValue: 64, entries: [{ date: today(), value: 64 }] });
    expect((entry.body as ChallengeDetail).me!.score).toBe(0);

    const done = await api()
      .put(`/api/v1/me/challenges/${id}/entries/${today()}`)
      .set("Authorization", athlete.bearer)
      .send({ value: 100 });
    expect((done.body as ChallengeDetail).me!.score).toBe(1);

    const yesterday = await api()
      .put(`/api/v1/me/challenges/${id}/entries/${addDays(today(), -1)}`)
      .set("Authorization", athlete.bearer)
      .send({ value: 100 });
    expect(yesterday.status).toBe(409);
    expect(yesterday.body.code).toBe("entry_not_today");
  });

  it("ändert, beendet und löscht nach den Regeln des Status", async () => {
    const { coach, athleteId, teammateId } = await setup();
    const planned = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(
        challenge([athleteId], { startDate: addDays(today(), 3), endDate: addDays(today(), 10) }),
      );
    const plannedId = (planned.body as ChallengeDetail).id;
    expect(planned.body.status).toBe("planned");
    sentMails.length = 0;

    const extended = await api()
      .patch(`/api/v1/coach/challenges/${plannedId}`)
      .set("Authorization", coach.bearer)
      .send({ participantIds: [athleteId, teammateId] });
    expect(extended.status).toBe(200);
    expect(extended.body.participantCount).toBe(2);
    // Nur der neue Teilnehmer bekommt eine Mail.
    expect(sentMails).toHaveLength(1);

    const endPlanned = await api()
      .post(`/api/v1/coach/challenges/${plannedId}/end`)
      .set("Authorization", coach.bearer);
    expect(endPlanned.body.code).toBe("challenge_not_started");

    const removed = await api()
      .delete(`/api/v1/coach/challenges/${plannedId}`)
      .set("Authorization", coach.bearer);
    expect(removed.status).toBe(204);

    const running = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId]));
    const runningId = (running.body as ChallengeDetail).id;
    const moveStart = await api()
      .patch(`/api/v1/coach/challenges/${runningId}`)
      .set("Authorization", coach.bearer)
      .send({ endDate: addDays(today(), 20) });
    expect(moveStart.body.code).toBe("challenge_started");
    const prize = await api()
      .patch(`/api/v1/coach/challenges/${runningId}`)
      .set("Authorization", coach.bearer)
      .send({ prize: "Shaker" });
    expect(prize.body.prize).toBe("Shaker");

    const ended = await api()
      .post(`/api/v1/coach/challenges/${runningId}/end`)
      .set("Authorization", coach.bearer);
    expect(ended.body).toMatchObject({ status: "finished", endedEarly: true, endDate: today() });
    const deleteRunning = await api()
      .delete(`/api/v1/coach/challenges/${runningId}`)
      .set("Authorization", coach.bearer);
    expect(deleteRunning.body.code).toBe("challenge_started");
  });

  it("zeigt Challenges nur Besitzer und Teilnehmern", async () => {
    const { coach, athleteId } = await setup();
    const created = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId]));
    const id = (created.body as ChallengeDetail).id;

    const otherCoach = await createAndLogin({ role: "coach" });
    const foreignCoach = await api()
      .get(`/api/v1/coach/challenges/${id}`)
      .set("Authorization", otherCoach.bearer);
    expect(foreignCoach.status).toBe(404);

    const outsider = await createAndLogin({ role: "athlete", coachId: coach.user._id });
    const foreignAthlete = await api()
      .get(`/api/v1/me/challenges/${id}`)
      .set("Authorization", outsider.bearer);
    expect(foreignAthlete.status).toBe(404);
  });

  it("entfernt einen gelöschten Athleten aus Challenges", async () => {
    const { coach, athleteId, teammateId } = await setup();
    const created = await api()
      .post("/api/v1/coach/challenges")
      .set("Authorization", coach.bearer)
      .send(challenge([athleteId, teammateId]));
    const deleted = await api()
      .delete(`/api/v1/athletes/${teammateId}`)
      .set("Authorization", coach.bearer);
    expect(deleted.status).toBe(204);

    const stored = await ChallengeModel.findById(created.body.id).lean();
    expect(stored!.participantIds.map(String)).toEqual([athleteId]);
  });
});
