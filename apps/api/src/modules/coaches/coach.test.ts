import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser, lastMailTo, login } from "../../../test/helpers";
import { sentMails } from "../../lib/mail/mailer";
import { UserModel } from "../users/user.model";

async function sysadmin() {
  return createAndLogin({ role: "sysadmin", name: "Sam Admin" });
}

describe("Coaches (Sysadmin)", () => {
  it("ist nur für Sysadmins zugänglich", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const athlete = await createAndLogin({ role: "athlete" });

    for (const { bearer } of [coach, athlete]) {
      const res = await api().get("/api/v1/coaches").set("Authorization", bearer);
      expect(res.status).toBe(403);
    }
  });

  it("lädt einen Coach per Mail ein, der danach sein Passwort setzt und angemeldet ist", async () => {
    const { bearer } = await sysadmin();

    const created = await api()
      .post("/api/v1/coaches")
      .set("Authorization", bearer)
      .send({ email: "Clara@Example.com", name: "Clara Coach", athleteQuota: 3 });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      email: "clara@example.com",
      status: "invited",
      athleteQuota: 3,
      athleteCount: 0,
      inviteSent: true,
    });

    const { mail, token } = lastMailTo("clara@example.com");
    expect(mail.text).toContain("Sam Admin hat dich zu AthletePT eingeladen");
    expect(mail.text).toContain("http://localhost:5173/invite#token=");

    const info = await api().post("/api/v1/auth/invitations/inspect").send({ token });
    expect(info.body).toEqual({
      name: "Clara Coach",
      email: "clara@example.com",
      role: "coach",
      healthDataConsentRequired: false,
    });

    const accepted = await api()
      .post("/api/v1/auth/invitations/accept")
      .send({ token, password: "mein-sicheres-passwort" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.user).toMatchObject({ role: "coach", status: "active" });
    expect(accepted.headers["set-cookie"]).toBeDefined();

    await expect(login("clara@example.com", "mein-sicheres-passwort")).resolves.toBeDefined();

    const again = await api()
      .post("/api/v1/auth/invitations/accept")
      .send({ token, password: "noch-ein-passwort" });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe("invalid_token");
  });

  it("lehnt eine bereits verwendete E-Mail ab", async () => {
    const { bearer } = await sysadmin();
    await createUser({ email: "vergeben@example.com" });

    const res = await api()
      .post("/api/v1/coaches")
      .set("Authorization", bearer)
      .send({ email: "vergeben@example.com", name: "X", athleteQuota: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("email_taken");
  });

  it("zählt aktive und eingeladene Athleten, aber keine archivierten", async () => {
    const { bearer } = await sysadmin();
    const coach = await createUser({ role: "coach" });
    await createUser({ role: "athlete", coachId: coach._id, status: "active" });
    await createUser({ role: "athlete", coachId: coach._id, status: "invited" });
    await createUser({ role: "athlete", coachId: coach._id, status: "disabled" });

    const res = await api().get("/api/v1/coaches").set("Authorization", bearer);

    expect(res.body).toEqual([expect.objectContaining({ id: coach.id, athleteCount: 2 })]);
  });

  it("sperrt einen Coach und beendet seine Sitzungen", async () => {
    const admin = await sysadmin();
    const coach = await createAndLogin({ role: "coach" });

    const res = await api()
      .patch(`/api/v1/coaches/${coach.user.id}`)
      .set("Authorization", admin.bearer)
      .send({ status: "disabled", athleteQuota: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "disabled", athleteQuota: 10 });
    const refresh = await api().post("/api/v1/auth/refresh").set("Cookie", coach.cookie);
    expect(refresh.status).toBe(401);
  });

  it("kann einen eingeladenen Coach nicht manuell aktivieren", async () => {
    const { bearer } = await sysadmin();
    const coach = await createUser({ role: "coach", status: "invited" });

    const res = await api()
      .patch(`/api/v1/coaches/${coach.id}`)
      .set("Authorization", bearer)
      .send({ status: "active" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("invitation_pending");
  });

  it("lädt einen vor dem Annehmen gesperrten Coach beim Entsperren neu ein", async () => {
    const { bearer } = await sysadmin();
    const created = await api()
      .post("/api/v1/coaches")
      .set("Authorization", bearer)
      .send({ email: "spaet@example.com", name: "Spät", athleteQuota: 1 });
    const patch = (status: string) =>
      api()
        .patch(`/api/v1/coaches/${created.body.id}`)
        .set("Authorization", bearer)
        .send({ status });

    await patch("disabled").expect(200);
    const res = await patch("active");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("invited");
    const { token } = lastMailTo("spaet@example.com");
    const accepted = await api()
      .post("/api/v1/auth/invitations/accept")
      .send({ token, password: "neues-coach-passwort" });
    expect(accepted.status).toBe(200);
  });

  it("macht beim erneuten Einladen den alten Link ungültig", async () => {
    const { bearer } = await sysadmin();
    await api()
      .post("/api/v1/coaches")
      .set("Authorization", bearer)
      .send({ email: "neu@example.com", name: "Neu", athleteQuota: 1 });
    const first = lastMailTo("neu@example.com").token;
    const coachId = (await api().get("/api/v1/coaches").set("Authorization", bearer)).body[0].id;

    const resent = await api()
      .post(`/api/v1/coaches/${coachId}/invitation`)
      .set("Authorization", bearer);

    expect(resent.body).toEqual({ inviteSent: true });
    expect(sentMails).toHaveLength(2);
    const old = await api().post("/api/v1/auth/invitations/inspect").send({ token: first });
    expect(old.status).toBe(400);
    const fresh = lastMailTo("neu@example.com").token;
    expect(
      (await api().post("/api/v1/auth/invitations/inspect").send({ token: fresh })).status,
    ).toBe(200);
  });

  it("liefert 404 für unbekannte Coaches", async () => {
    const { bearer } = await sysadmin();

    const res = await api()
      .patch("/api/v1/coaches/6acd3920c0072ec254663bd8")
      .set("Authorization", bearer)
      .send({ name: "X" });

    expect(res.status).toBe(404);
  });
});

describe("Coach sperren mit Übergabe der Athleten", () => {
  /** Coach mit zwei aktiven, einem eingeladenen und einem archivierten Athleten. */
  async function coachWithAthletes() {
    const coach = await createAndLogin({ role: "coach", name: "Clara Coach" });
    const athletes = await Promise.all(
      (["active", "active", "invited", "disabled"] as const).map((status) =>
        createUser({ role: "athlete", coachId: coach.user._id, status }),
      ),
    );
    return { coach, athletes };
  }

  const disable = (bearer: string, coachId: string, body: object = {}) =>
    api()
      .patch(`/api/v1/coaches/${coachId}`)
      .set("Authorization", bearer)
      .send({ status: "disabled", ...body });

  async function coachIdsOf(athleteIds: string[]) {
    const athletes = await UserModel.find({ _id: { $in: athleteIds } });
    return athletes.map((a) => a.coachId?.toString());
  }

  it("übergibt alle Athleten, auch archivierte, an den neuen Coach", async () => {
    const admin = await sysadmin();
    const { coach, athletes } = await coachWithAthletes();
    const target = await createUser({ role: "coach", athleteQuota: 3 });

    const res = await disable(admin.bearer, coach.user.id, { reassignToCoachId: target.id });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "disabled",
      athleteCount: 0,
      archivedAthleteCount: 0,
    });
    expect(await coachIdsOf(athletes.map((a) => a.id))).toEqual(Array(4).fill(target.id));
    const list = await api().get("/api/v1/coaches").set("Authorization", admin.bearer);
    expect(list.body).toContainEqual(
      expect.objectContaining({ id: target.id, athleteCount: 3, archivedAthleteCount: 1 }),
    );
    // Der gesperrte Coach ist abgemeldet.
    expect((await api().post("/api/v1/auth/refresh").set("Cookie", coach.cookie)).status).toBe(401);
  });

  it("verlangt einen übernehmenden Coach, wenn noch Athleten da sind", async () => {
    const admin = await sysadmin();
    const { coach } = await coachWithAthletes();

    const res = await disable(admin.bearer, coach.user.id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("reassignment_required");
    expect(res.body.errors[0].path).toBe("reassignToCoachId");
  });

  it("bricht ab, wenn das Kontingent des neuen Coaches nicht reicht, und ändert nichts", async () => {
    const admin = await sysadmin();
    const { coach, athletes } = await coachWithAthletes();
    const target = await createUser({ role: "coach", athleteQuota: 4, name: "Ben Berger" });
    await createUser({ role: "athlete", coachId: target._id });
    await createUser({ role: "athlete", coachId: target._id });

    const res = await disable(admin.bearer, coach.user.id, {
      reassignToCoachId: target.id,
      name: "Neuer Name",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("quota_exceeded");
    expect(res.body.detail).toBe(
      "Ben Berger hat nur 2 freie Plätze, es kommen aber 3 Athleten dazu. Erhöhe zuerst das Kontingent von Ben Berger oder wähle einen anderen Coach.",
    );
    // Transaktion zurückgerollt: Coach weder gesperrt noch umbenannt, Athleten unverändert.
    expect(await UserModel.findById(coach.user._id)).toMatchObject({
      status: "active",
      name: "Clara Coach",
    });
    expect(await coachIdsOf(athletes.map((a) => a.id))).toEqual(Array(4).fill(coach.user.id));
    expect((await api().post("/api/v1/auth/refresh").set("Cookie", coach.cookie)).status).toBe(200);
  });

  it("übergibt nur an aktive Coaches", async () => {
    const admin = await sysadmin();
    const { coach } = await coachWithAthletes();
    const disabled = await createUser({ role: "coach", status: "disabled", athleteQuota: 10 });
    const invited = await createUser({ role: "coach", status: "invited", athleteQuota: 10 });
    const athlete = await createUser({ role: "athlete" });

    for (const target of [disabled, invited, athlete, coach.user]) {
      const res = await disable(admin.bearer, coach.user.id, { reassignToCoachId: target.id });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("reassignment_invalid");
    }
  });

  it("sperrt Coaches ohne Athleten auch ohne Übergabe", async () => {
    const admin = await sysadmin();
    const coach = await createUser({ role: "coach" });

    const res = await disable(admin.bearer, coach.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("disabled");
  });

  it("ignoriert den Ziel-Coach, wenn gar nicht gesperrt wird", async () => {
    const admin = await sysadmin();
    const { coach, athletes } = await coachWithAthletes();
    const target = await createUser({ role: "coach", athleteQuota: 10 });

    const res = await api()
      .patch(`/api/v1/coaches/${coach.user.id}`)
      .set("Authorization", admin.bearer)
      .send({ name: "Clara C.", reassignToCoachId: target.id });

    expect(res.status).toBe(200);
    expect(await coachIdsOf(athletes.map((a) => a.id))).toEqual(Array(4).fill(coach.user.id));
  });
});
