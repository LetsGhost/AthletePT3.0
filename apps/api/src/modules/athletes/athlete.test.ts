import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CONSENT, api, createAndLogin, createUser, lastMailTo } from "../../../test/helpers";
import { sentMails } from "../../lib/mail/mailer";
import { enforceRateLimitsInTests } from "../../middleware/rate-limit";
import { SessionModel } from "../auth/session.model";
import { UserModel } from "../users/user.model";
import { AthleteProfileModel } from "./athlete-profile.model";
import * as athleteService from "./athlete.service";

const newAthlete = {
  email: "max@example.com",
  name: "Max Muster",
  profile: {
    birthDate: "1995-04-12",
    sex: "male" as const,
    heightCm: 182,
    goal: "Fett abbauen, Kraft halten",
    focus: "Oberkörper",
    trainingsPerWeek: 4,
    physicalIssues: "Leichte Knieprobleme links",
  },
};

async function coach(quota = 5) {
  return createAndLogin({ role: "coach", athleteQuota: quota, name: "Clara Coach" });
}

describe("Athleten (Coach)", () => {
  it("legt einen Athleten mit Anamnese an und lädt ihn ein", async () => {
    const { bearer } = await coach();

    const res = await api().post("/api/v1/athletes").set("Authorization", bearer).send(newAthlete);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Max Muster",
      status: "invited",
      goal: "Fett abbauen, Kraft halten",
      inviteSent: true,
      profile: newAthlete.profile,
    });
    expect(lastMailTo("max@example.com").mail.text).toContain("Clara Coach hat dich");
  });

  it("verweigert die Anlage, wenn das Kontingent ausgeschöpft ist", async () => {
    const { user, bearer } = await coach(1);
    await createUser({ role: "athlete", coachId: user._id });

    const res = await api().post("/api/v1/athletes").set("Authorization", bearer).send(newAthlete);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("quota_exceeded");
  });

  it("überschreitet das Kontingent auch bei gleichzeitigen Anlagen nicht", async () => {
    const { user, bearer } = await coach(1);

    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        api()
          .post("/api/v1/athletes")
          .set("Authorization", bearer)
          .send({ ...newAthlete, email: `parallel${n}@example.com` }),
      ),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await UserModel.countDocuments({ coachId: user._id })).toBe(1);
  });

  it("zeigt Athleten anderer Coaches nicht (404 statt 403)", async () => {
    const other = await coach();
    const mine = await coach();
    const foreign = await createUser({ role: "athlete", coachId: other.user._id });

    const get = await api().get(`/api/v1/athletes/${foreign.id}`).set("Authorization", mine.bearer);
    const patch = await api()
      .patch(`/api/v1/athletes/${foreign.id}`)
      .set("Authorization", mine.bearer)
      .send({ name: "Gehackt" });
    const del = await api()
      .delete(`/api/v1/athletes/${foreign.id}`)
      .set("Authorization", mine.bearer);
    const list = await api().get("/api/v1/athletes").set("Authorization", mine.bearer);

    expect([get.status, patch.status, del.status]).toEqual([404, 404, 404]);
    expect(list.body.items).toEqual([]);
    expect((await UserModel.findById(foreign.id))?.name).not.toBe("Gehackt");
  });

  it("ist für Athleten gesperrt", async () => {
    const { bearer } = await createAndLogin({ role: "athlete" });

    const res = await api().get("/api/v1/athletes").set("Authorization", bearer);

    expect(res.status).toBe(403);
  });

  it("liefert die Liste mit Kontingent", async () => {
    const { user, bearer } = await coach(3);
    await createUser({ role: "athlete", coachId: user._id, name: "B" });
    await createUser({ role: "athlete", coachId: user._id, name: "A", status: "disabled" });

    const res = await api().get("/api/v1/athletes").set("Authorization", bearer);

    expect(res.body.quota).toEqual({ used: 1, limit: 3 });
    expect(res.body.items.map((a: { name: string }) => a.name)).toEqual(["A", "B"]);
  });

  it("ersetzt beim Bearbeiten die Anamnese vollständig", async () => {
    const { bearer } = await coach();
    const created = await api()
      .post("/api/v1/athletes")
      .set("Authorization", bearer)
      .send(newAthlete);

    const res = await api()
      .patch(`/api/v1/athletes/${created.body.id}`)
      .set("Authorization", bearer)
      .send({ name: "Max M.", profile: { goal: "Muskelaufbau" } });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Max M.");
    expect(res.body.profile).toEqual({ goal: "Muskelaufbau" });
  });

  it("prüft die Anamnese-Felder", async () => {
    const { bearer } = await coach();

    const res = await api()
      .post("/api/v1/athletes")
      .set("Authorization", bearer)
      .send({ ...newAthlete, profile: { birthDate: "1800-01-01", heightCm: 50 } });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(
      expect.arrayContaining(["profile.birthDate", "profile.heightCm"]),
    );
  });

  it("archiviert: sperrt den Zugang und gibt den Platz frei; Reaktivieren belegt ihn wieder", async () => {
    const { user, bearer } = await coach(1);
    const athlete = await createAndLogin({ role: "athlete", coachId: user._id });

    const archived = await api()
      .post(`/api/v1/athletes/${athlete.user.id}/archive`)
      .set("Authorization", bearer);
    expect(archived.body.status).toBe("disabled");
    expect((await api().post("/api/v1/auth/refresh").set("Cookie", athlete.cookie)).status).toBe(
      401,
    );

    const other = await api()
      .post("/api/v1/athletes")
      .set("Authorization", bearer)
      .send(newAthlete);
    expect(other.status).toBe(201);

    const reactivate = await api()
      .post(`/api/v1/athletes/${athlete.user.id}/reactivate`)
      .set("Authorization", bearer);
    expect(reactivate.status).toBe(409);
    expect(reactivate.body.code).toBe("quota_exceeded");
  });

  it("reaktiviert einen Athleten mit Passwort als aktiv", async () => {
    const { user, bearer } = await coach();
    const athlete = await createUser({ role: "athlete", coachId: user._id, status: "disabled" });

    const res = await api()
      .post(`/api/v1/athletes/${athlete.id}/reactivate`)
      .set("Authorization", bearer);

    expect(res.body.status).toBe("active");
  });

  it("löscht einen Athleten mit allen Daten", async () => {
    const { bearer } = await coach();
    const created = await api()
      .post("/api/v1/athletes")
      .set("Authorization", bearer)
      .send(newAthlete);
    const { token } = lastMailTo("max@example.com");
    await api()
      .post("/api/v1/auth/invitations/accept")
      .send({ token, password: "athleten-passwort", healthDataConsent: CONSENT });

    const res = await api()
      .delete(`/api/v1/athletes/${created.body.id}`)
      .set("Authorization", bearer);

    expect(res.status).toBe(204);
    expect(await UserModel.exists({ _id: created.body.id })).toBeNull();
    expect(await AthleteProfileModel.exists({ athleteId: created.body.id })).toBeNull();
    expect(await SessionModel.exists({ userId: created.body.id })).toBeNull();
  });

  it("sendet Einladungen nur an noch nicht aktivierte Athleten erneut", async () => {
    const { user, bearer } = await coach();
    const active = await createUser({ role: "athlete", coachId: user._id });

    const res = await api()
      .post(`/api/v1/athletes/${active.id}/invitation`)
      .set("Authorization", bearer);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("not_invited");
  });
});

describe("Gesperrter Coach", () => {
  // Direkt gegen den Service: Unabhängig davon, ob ein alter Access-Token noch durchkommt,
  // darf bei einem gesperrten Coach nichts mehr landen.
  it("kann keine Athleten anlegen, reaktivieren oder einladen", async () => {
    const coachUser = await createUser({ role: "coach", status: "disabled", athleteQuota: 5 });
    const archived = await createUser({
      role: "athlete",
      status: "disabled",
      coachId: coachUser._id,
    });
    const invited = await createUser({
      role: "athlete",
      status: "invited",
      coachId: coachUser._id,
    });

    const attempts = [
      () => athleteService.createAthlete(coachUser.id, newAthlete),
      () => athleteService.reactivateAthlete(coachUser.id, archived.id),
      () => athleteService.resendAthleteInvitation(coachUser.id, invited.id),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({ status: 403, code: "coach_inactive" });
    }

    expect(await UserModel.exists({ email: newAthlete.email })).toBeNull();
    expect((await UserModel.findById(archived._id))?.status).toBe("disabled");
    expect(sentMails).toHaveLength(0);
  });
});

describe("Mail-Limit beim Anlegen und Reaktivieren", () => {
  beforeEach(() => enforceRateLimitsInTests(true));
  afterEach(() => enforceRateLimitsInTests(false));

  it("begrenzt Anlegen und Reaktivieren gemeinsam mit dem Mail-Limiter", async () => {
    const { user, bearer } = await coach(50);
    const archived = await createUser({ role: "athlete", status: "disabled", coachId: user._id });

    for (let i = 0; i < 10; i += 1) {
      const res = await api()
        .post("/api/v1/athletes")
        .set("Authorization", bearer)
        .send({ ...newAthlete, email: `limit${i}@example.com` });
      expect(res.status).toBe(201);
    }

    const create = await api()
      .post("/api/v1/athletes")
      .set("Authorization", bearer)
      .send({ ...newAthlete, email: "limit10@example.com" });
    const reactivate = await api()
      .post(`/api/v1/athletes/${archived.id}/reactivate`)
      .set("Authorization", bearer);

    expect(create.status).toBe(429);
    expect(reactivate.status).toBe(429);
    expect(await UserModel.exists({ email: "limit10@example.com" })).toBeNull();
  });
});
