import { PRIVACY_POLICY_VERSION } from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { CONSENT, api, createAndLogin, lastMailTo } from "../../../test/helpers";
import { UserModel } from "../users/user.model";

/** Coach lädt einen Athleten ein, liefert das Token aus der Mail. */
async function inviteAthlete() {
  const { bearer } = await createAndLogin({ role: "coach" });
  await api()
    .post("/api/v1/athletes")
    .set("Authorization", bearer)
    .send({ email: "max@example.com", name: "Max Muster", profile: {} });
  return lastMailTo("max@example.com").token;
}

const accept = (body: object) => api().post("/api/v1/auth/invitations/accept").send(body);

describe("Einwilligung in Gesundheitsdaten (Art. 9 DSGVO)", () => {
  it("fordert die Einwilligung nur bei Athleten an", async () => {
    const token = await inviteAthlete();

    const info = await api().post("/api/v1/auth/invitations/inspect").send({ token });

    expect(info.body).toMatchObject({ role: "athlete", healthDataConsentRequired: true });
  });

  it("nimmt die Einladung ohne Einwilligung nicht an, der Link bleibt gültig", async () => {
    const token = await inviteAthlete();

    const res = await accept({ token, password: "athleten-passwort" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("consent_required");
    expect(res.body.errors).toEqual([
      { path: "healthDataConsent", message: expect.any(String) as string },
    ]);
    const athlete = await UserModel.findOne({ email: "max@example.com" });
    expect(athlete).toMatchObject({ status: "invited", healthDataConsent: null });
    expect((await api().post("/api/v1/auth/invitations/inspect").send({ token })).status).toBe(200);
  });

  it("lehnt eine Einwilligung ab, die nicht ausdrücklich erteilt wurde", async () => {
    const token = await inviteAthlete();

    const res = await accept({
      token,
      password: "athleten-passwort",
      healthDataConsent: { accepted: false, privacyPolicyVersion: PRIVACY_POLICY_VERSION },
    });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe("healthDataConsent.accepted");
  });

  it("lehnt eine Einwilligung zu einer veralteten Datenschutzerklärung ab", async () => {
    const token = await inviteAthlete();

    const res = await accept({
      token,
      password: "athleten-passwort",
      healthDataConsent: { accepted: true, privacyPolicyVersion: "2020-01-01" },
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("privacy_policy_outdated");
  });

  it("speichert Zeitpunkt und Version der Einwilligung", async () => {
    const token = await inviteAthlete();
    const before = Date.now();

    const res = await accept({ token, password: "athleten-passwort", healthDataConsent: CONSENT });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: "athlete", status: "active" });
    const athlete = await UserModel.findOne({ email: "max@example.com" });
    expect(athlete?.healthDataConsent?.privacyPolicyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(athlete?.healthDataConsent?.grantedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("braucht bei Coaches keine Einwilligung", async () => {
    const { bearer } = await createAndLogin({ role: "sysadmin" });
    await api()
      .post("/api/v1/coaches")
      .set("Authorization", bearer)
      .send({ email: "clara@example.com", name: "Clara", athleteQuota: 1 });
    const { token } = lastMailTo("clara@example.com");

    const res = await accept({ token, password: "coach-passwort-123" });

    expect(res.status).toBe(200);
    const coach = await UserModel.findOne({ email: "clara@example.com" });
    expect(coach?.healthDataConsent).toBeNull();
  });
});
