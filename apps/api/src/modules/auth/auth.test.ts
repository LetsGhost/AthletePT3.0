import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PASSWORD,
  api,
  createAndLogin,
  createUser,
  login,
  refreshCookieFrom,
} from "../../../test/helpers";
import { UserModel } from "../users/user.model";
import { UserTokenModel } from "../users/user-token.model";
import { SessionModel } from "./session.model";

describe("POST /auth/login", () => {
  it("liefert Access-Token und User ohne Passwort-Daten und setzt ein httpOnly-Cookie", async () => {
    const user = await createUser({ role: "coach" });

    const res = await api()
      .post("/api/v1/auth/login")
      .send({ email: user.email.toUpperCase(), password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: user.email, role: "coach", status: "active" });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
      c.startsWith("atp_refresh="),
    );
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it("antwortet bei unbekannter E-Mail und falschem Passwort identisch", async () => {
    const user = await createUser();

    const wrongPassword = await api()
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "falsch-falsch" });
    const unknownEmail = await api()
      .post("/api/v1/auth/login")
      .send({ email: "niemand@example.com", password: "falsch-falsch" });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({ status: 401, code: "invalid_credentials" });
    }
  });

  it("lässt eingeladene User ohne Passwort nicht rein und meldet gesperrte Konten", async () => {
    const invited = await createUser({ status: "invited" });
    const disabled = await createUser({ status: "disabled" });

    const invitedRes = await api()
      .post("/api/v1/auth/login")
      .send({ email: invited.email, password: DEFAULT_PASSWORD });
    const disabledRes = await api()
      .post("/api/v1/auth/login")
      .send({ email: disabled.email, password: DEFAULT_PASSWORD });

    expect(invitedRes.status).toBe(401);
    expect(disabledRes.status).toBe(403);
    expect(disabledRes.body.code).toBe("account_disabled");
  });

  it("validiert den Body und liefert Feldfehler", async () => {
    const res = await api().post("/api/v1/auth/login").send({ email: "kein-mail", password: "" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation_failed");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "email" }),
        expect.objectContaining({ path: "password" }),
      ]),
    );
  });

  it("meldet kaputtes JSON als 400", async () => {
    const res = await api()
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{kaputt");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_json");
  });
});

describe("GET /auth/me", () => {
  it("verlangt ein gültiges Token", async () => {
    const missing = await api().get("/api/v1/auth/me");
    const invalid = await api().get("/api/v1/auth/me").set("Authorization", "Bearer abc.def.ghi");

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(invalid.body.code).toBe("invalid_token");
  });

  it("liefert den angemeldeten User", async () => {
    const { user, bearer } = await createAndLogin({ role: "athlete" });

    const res = await api().get("/api/v1/auth/me").set("Authorization", bearer);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user._id.toString(), role: "athlete" });
  });
});

describe("POST /auth/refresh", () => {
  it("rotiert das Refresh-Token", async () => {
    const { cookie } = await createAndLogin();

    const res = await api().post("/api/v1/auth/refresh").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const newCookie = refreshCookieFrom(res);
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(cookie);
  });

  it("meldet einen parallelen Refresh als Konflikt statt die Sitzung zu beenden", async () => {
    const { cookie } = await createAndLogin();

    const first = await api().post("/api/v1/auth/refresh").set("Cookie", cookie);
    const second = await api().post("/api/v1/auth/refresh").set("Cookie", cookie);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("refresh_conflict");

    // Das neue Token funktioniert weiterhin.
    const third = await api().post("/api/v1/auth/refresh").set("Cookie", refreshCookieFrom(first)!);
    expect(third.status).toBe(200);
  });

  it("widerruft die ganze Sitzungsfamilie, wenn ein altes Token später wieder auftaucht", async () => {
    const { cookie } = await createAndLogin();
    const first = await api().post("/api/v1/auth/refresh").set("Cookie", cookie);
    const newCookie = refreshCookieFrom(first)!;

    // Rotation liegt außerhalb des Kulanzfensters.
    await SessionModel.updateMany(
      { rotatedAt: { $ne: null } },
      { rotatedAt: new Date(Date.now() - 60_000) },
    );

    const replay = await api().post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(replay.status).toBe(401);

    const legit = await api().post("/api/v1/auth/refresh").set("Cookie", newCookie);
    expect(legit.status).toBe(401);
  });

  it("antwortet ohne Cookie mit 401", async () => {
    const res = await api().post("/api/v1/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("no_session");
  });

  it("beendet die Sitzung, wenn der User inzwischen gesperrt ist", async () => {
    const { user, cookie } = await createAndLogin();
    user.status = "disabled";
    await user.save();

    const res = await api().post("/api/v1/auth/refresh").set("Cookie", cookie);

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("widerruft die Sitzung", async () => {
    const { cookie } = await createAndLogin();

    const logout = await api().post("/api/v1/auth/logout").set("Cookie", cookie);
    const refresh = await api().post("/api/v1/auth/refresh").set("Cookie", cookie);

    expect(logout.status).toBe(204);
    expect(refresh.status).toBe(401);
  });
});

describe("POST /auth/change-password", () => {
  it("lehnt ein falsches aktuelles Passwort ab", async () => {
    const { bearer } = await createAndLogin();

    const res = await api()
      .post("/api/v1/auth/change-password")
      .set("Authorization", bearer)
      .send({ currentPassword: "falsch-falsch", newPassword: "ein-neues-passwort" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("wrong_password");
  });

  it("prüft die Passwort-Policy", async () => {
    const { bearer } = await createAndLogin();

    const res = await api()
      .post("/api/v1/auth/change-password")
      .set("Authorization", bearer)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "kurz" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe("newPassword");
  });

  it("macht offene Reset-Links ungültig", async () => {
    const { user, bearer, cookie } = await createAndLogin();
    await api().post("/api/v1/auth/password-reset/request").send({ email: user.email });
    expect(await UserTokenModel.countDocuments({ userId: user._id })).toBe(1);

    await api()
      .post("/api/v1/auth/change-password")
      .set("Authorization", bearer)
      .set("Cookie", cookie)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "ein-neues-passwort" })
      .expect(204);

    expect(await UserTokenModel.countDocuments({ userId: user._id })).toBe(0);
  });

  it("ändert das Passwort und meldet nur die anderen Geräte ab", async () => {
    const { user, bearer, cookie } = await createAndLogin();
    const otherDevice = await login(user.email);

    const res = await api()
      .post("/api/v1/auth/change-password")
      .set("Authorization", bearer)
      .set("Cookie", cookie)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "ein-neues-passwort" });

    expect(res.status).toBe(204);
    expect((await api().post("/api/v1/auth/refresh").set("Cookie", cookie)).status).toBe(200);
    expect(
      (await api().post("/api/v1/auth/refresh").set("Cookie", otherDevice.cookie)).status,
    ).toBe(401);
    await expect(login(user.email, "ein-neues-passwort")).resolves.toBeDefined();
  });
});

describe("Sofortiger Widerruf von Access-Tokens", () => {
  const me = (bearer: string) => api().get("/api/v1/auth/me").set("Authorization", bearer);

  it("weist das Token eines archivierten Athleten sofort ab", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const athlete = await createAndLogin({ role: "athlete", coachId: coach.user._id });

    await api()
      .post(`/api/v1/athletes/${athlete.user.id}/archive`)
      .set("Authorization", coach.bearer)
      .expect(200);

    const res = await api().get("/api/v1/me/workout-logs").set("Authorization", athlete.bearer);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("token_revoked");
  });

  it("weist das Token eines gesperrten Coaches sofort ab", async () => {
    const admin = await createAndLogin({ role: "sysadmin" });
    const coach = await createAndLogin({ role: "coach" });

    await api()
      .patch(`/api/v1/coaches/${coach.user.id}`)
      .set("Authorization", admin.bearer)
      .send({ status: "disabled" })
      .expect(200);

    const res = await api()
      .post("/api/v1/athletes")
      .set("Authorization", coach.bearer)
      .send({ email: "neu@example.com", name: "Neu", profile: {} });
    expect(res.status).toBe(401);
    expect(await UserModel.exists({ email: "neu@example.com" })).toBeNull();
  });

  it("meldet nach einem Passwortwechsel andere Geräte sofort ab, das aktuelle per Refresh nicht", async () => {
    const { user, bearer, cookie } = await createAndLogin();
    const otherDevice = await login(user.email);

    await api()
      .post("/api/v1/auth/change-password")
      .set("Authorization", bearer)
      .set("Cookie", cookie)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "ein-neues-passwort" })
      .expect(204);

    expect((await me(otherDevice.bearer)).status).toBe(401);
    expect((await me(bearer)).body.code).toBe("token_revoked");

    const refreshed = await api().post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(refreshed.status).toBe(200);
    expect((await me(`Bearer ${refreshed.body.accessToken as string}`)).status).toBe(200);
  });

  it("weist Tokens ab, deren Rolle nicht mehr stimmt", async () => {
    const { user, bearer } = await createAndLogin({ role: "coach" });
    await UserModel.updateOne({ _id: user._id }, { role: "athlete" });

    expect((await me(bearer)).status).toBe(401);
  });

  it("weist Tokens ohne Versions-Claim ab", async () => {
    const user = await createUser();
    const legacy = jwt.sign({ role: user.role }, process.env.JWT_SECRET!, {
      algorithm: "HS256",
      subject: user.id,
      issuer: "athletept-api",
      audience: "athletept",
      expiresIn: 60,
    });

    const res = await me(`Bearer ${legacy}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("invalid_token");
  });
});
