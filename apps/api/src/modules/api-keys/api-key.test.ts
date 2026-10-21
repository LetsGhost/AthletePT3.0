import type { ApiKeyScope, CreateExerciseRequest, CreatePlanRequest } from "@athletept/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api, createAndLogin, createUser } from "../../../test/helpers";
import { enforceRateLimitsInTests } from "../../middleware/rate-limit";
import { UserModel, type UserDocument } from "../users/user.model";
import { ApiKeyAuditModel, ApiKeyModel } from "./api-key.model";
import * as apiKeyService from "./api-key.service";

let sysadminId: string;

beforeEach(async () => {
  sysadminId = (await createUser({ role: "sysadmin" }))._id.toString();
});

const admin = () => ({ userId: sysadminId, role: "sysadmin" as const });

/** Legt einen Key an und holt ihn ab (wie später über den Abhol-Link). */
async function createKey(
  user: UserDocument,
  scopes: ApiKeyScope[],
  options: { rateLimit?: number } = {},
) {
  const pending = await apiKeyService.createApiKey(admin(), {
    userId: user._id.toString(),
    name: "Trainings-Tracker",
    scopes,
    ...options,
  });
  const { apiKey, key } = await apiKeyService.issueApiKey(pending._id.toString());
  return { id: apiKey._id.toString(), key, bearer: `Bearer ${key}` };
}

async function coachWithAthlete(ownPlan = false) {
  const coach = await createAndLogin({ role: "coach" });
  const athlete = await createUser({ coachId: coach.user._id });
  await api()
    .patch(`/api/v1/athletes/${athlete._id.toString()}`)
    .set("Authorization", coach.bearer)
    .send({ permissions: { ownPlan } })
    .expect(200);
  return { coach, athlete };
}

const exerciseBody: CreateExerciseRequest = {
  name: "Bankdrücken",
  aliases: [],
  category: "compound",
  equipment: "barbell",
  primaryMuscles: ["chest"],
};

function planBody(exerciseId: string): CreatePlanRequest {
  return {
    name: "Plan aus der App",
    days: [
      {
        name: "Tag A",
        weekday: 1,
        warmup: [],
        exercises: [{ exerciseId, sets: [{ kind: "working", repsMin: 8 }] }],
      },
    ],
  };
}

async function coachExercise(coachBearer: string) {
  const res = await api()
    .post("/api/v1/exercises")
    .set("Authorization", coachBearer)
    .send(exerciseBody)
    .expect(201);
  return res.body.id as string;
}

describe("API-Keys anlegen", () => {
  it("erzeugt den Key erst beim Abholen und speichert nur den Hash", async () => {
    const athlete = await createUser();
    const pending = await apiKeyService.createApiKey(admin(), {
      userId: athlete._id.toString(),
      name: "Tracker",
      scopes: ["plans:read", "plans:read"],
    });
    expect(pending.status).toBe("pending");
    expect(pending.keyHash).toBeNull();
    expect(pending.scopes).toEqual(["plans:read"]);

    const { key, apiKey } = await apiKeyService.issueApiKey(pending._id.toString());
    expect(key).toMatch(/^apt_[\w-]{43}$/);
    expect(apiKey.status).toBe("active");
    expect(apiKey.keyHash).not.toContain(key);
    expect(apiKey.keyPreview).toBe(key.slice(0, 8));
    const days = (apiKey.expiresAt!.getTime() - apiKey.activatedAt!.getTime()) / 86_400_000;
    expect(days).toBe(365);

    const stored = await ApiKeyModel.findById(apiKey._id).lean();
    expect(JSON.stringify(stored)).not.toContain(key);
  });

  it("gibt einen Key nur einmal heraus", async () => {
    const athlete = await createUser();
    const pending = await apiKeyService.createApiKey(admin(), {
      userId: athlete._id.toString(),
      name: "Tracker",
      scopes: ["plans:read"],
    });
    await apiKeyService.issueApiKey(pending._id.toString());
    await expect(apiKeyService.issueApiKey(pending._id.toString())).rejects.toMatchObject({
      status: 404,
    });
  });

  it("lehnt Sysadmins, gesperrte Nutzer und Coach-Bereiche für Athleten ab", async () => {
    const sysadmin = await createUser({ role: "sysadmin" });
    const disabled = await createUser({ status: "disabled" });
    const athlete = await createUser();
    const create = (userId: string, scopes: ApiKeyScope[]) =>
      apiKeyService.createApiKey(admin(), { userId, name: "Tracker", scopes });

    await expect(create(sysadmin._id.toString(), ["plans:read"])).rejects.toMatchObject({
      code: "api_key_role_invalid",
    });
    await expect(create(disabled._id.toString(), ["plans:read"])).rejects.toMatchObject({
      code: "api_key_user_disabled",
    });
    await expect(create(athlete._id.toString(), ["athletes:read"])).rejects.toMatchObject({
      code: "api_key_scope_invalid",
    });
    await expect(create(athlete._id.toString(), [])).rejects.toMatchObject({
      code: "api_key_scope_invalid",
    });
  });

  it("erlaubt höchstens drei gültige Keys; widerrufene und abgelaufene zählen nicht", async () => {
    const athlete = await createUser();
    const keys = [];
    for (let i = 0; i < 3; i += 1) keys.push(await createKey(athlete, ["plans:read"]));

    await expect(createKey(athlete, ["plans:read"])).rejects.toMatchObject({
      code: "api_key_limit_reached",
    });

    await apiKeyService.revokeApiKey(keys[0]!.id, sysadminId);
    await ApiKeyModel.updateOne({ _id: keys[1]!.id }, { expiresAt: new Date(Date.now() - 1000) });
    await createKey(athlete, ["plans:read"]);
    await createKey(athlete, ["plans:read"]);
    await expect(createKey(athlete, ["plans:read"])).rejects.toMatchObject({
      code: "api_key_limit_reached",
    });
  });
});

describe("Authentifizierung mit API-Key", () => {
  it("handelt im Namen des Nutzers", async () => {
    const athlete = await createUser({ name: "Alex App" });
    const { bearer } = await createKey(athlete, ["plans:read"]);

    const res = await api().get("/api/v1/auth/me").set("Authorization", bearer);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: athlete._id.toString(), role: "athlete" });
  });

  it("merkt sich letzte Nutzung und zählt Requests", async () => {
    const athlete = await createUser();
    const { id, bearer } = await createKey(athlete, ["plans:read"]);

    await api().get("/api/v1/auth/me").set("Authorization", bearer).expect(200);
    await api().get("/api/v1/me/plan").set("Authorization", bearer).expect(200);

    const stored = await ApiKeyModel.findById(id).lean();
    expect(stored?.requestCount).toBe(2);
    expect(stored?.lastUsedAt).toBeInstanceOf(Date);
  });

  it("weist unbekannte, noch nicht abgeholte, widerrufene und abgelaufene Keys ab", async () => {
    const athlete = await createUser();
    const me = (bearer: string) => api().get("/api/v1/auth/me").set("Authorization", bearer);

    const unknown = await me("Bearer apt_gibtesnicht");
    expect(unknown.status).toBe(401);
    expect(unknown.body.code).toBe("api_key_invalid");

    const revoked = await createKey(athlete, ["plans:read"]);
    await apiKeyService.revokeApiKey(revoked.id, sysadminId);
    expect((await me(revoked.bearer)).body.code).toBe("api_key_revoked");

    const expired = await createKey(athlete, ["plans:read"]);
    await ApiKeyModel.updateOne({ _id: expired.id }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await me(expired.bearer)).body.code).toBe("api_key_expired");
  });

  it("wird ungültig, sobald der Nutzer gesperrt ist oder seine Rolle wechselt", async () => {
    const athlete = await createUser();
    const blocked = await createKey(athlete, ["plans:read"]);
    const coach = await createUser({ role: "coach" });
    const roleChanged = await createKey(coach, ["plans:read"]);

    await UserModel.updateOne({ _id: athlete._id }, { status: "disabled" });
    await UserModel.updateOne({ _id: coach._id }, { role: "athlete" });

    for (const { bearer } of [blocked, roleChanged]) {
      const res = await api().get("/api/v1/auth/me").set("Authorization", bearer);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("api_key_invalid");
    }
  });

  it("bleibt gültig, wenn der Nutzer sich überall abmeldet", async () => {
    const { user } = await createAndLogin();
    const { bearer } = await createKey(user, ["plans:read"]);

    await UserModel.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });

    await api().get("/api/v1/auth/me").set("Authorization", bearer).expect(200);
  });
});

describe("Bereiche (Scopes)", () => {
  it("sperrt Routen ohne Bereich für API-Keys, auch mit allen Bereichen", async () => {
    const { coach } = await coachWithAthlete();
    const { bearer } = await createKey(coach.user, [
      "exercises:read",
      "exercises:write",
      "plans:read",
      "plans:write",
      "workouts:read",
      "workouts:write",
      "stats:read",
      "athletes:read",
    ]);

    const blocked = [
      api().post("/api/v1/auth/change-password").send({ currentPassword: "x", newPassword: "y" }),
      api().get("/api/v1/exercises/notices"),
      api().get("/api/v1/exercises/athlete-exercises"),
      api().post("/api/v1/athletes").send({ email: "neu@example.com", name: "Neu" }),
    ];
    for (const req of blocked) {
      const res = await req.set("Authorization", bearer);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("api_key_route_forbidden");
    }
  });

  it("verlangt den passenden Bereich", async () => {
    const athlete = await createUser();
    const { bearer } = await createKey(athlete, ["plans:read"]);

    const res = await api().get("/api/v1/me/workout-logs").set("Authorization", bearer);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("api_key_scope_missing");
    await api().get("/api/v1/me/plan").set("Authorization", bearer).expect(200);
  });

  it("lesender Bereich erlaubt keine Schreibzugriffe", async () => {
    const coach = await createUser({ role: "coach" });
    const { bearer } = await createKey(coach, ["exercises:read"]);

    await api().get("/api/v1/exercises").set("Authorization", bearer).expect(200);
    const res = await api()
      .post("/api/v1/exercises")
      .set("Authorization", bearer)
      .send(exerciseBody);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("api_key_scope_missing");
  });

  it("erweitert nie die Rechte des Nutzers: Athlet ohne ownPlan darf keine Pläne anlegen", async () => {
    const { coach, athlete } = await coachWithAthlete(false);
    const exerciseId = await coachExercise(coach.bearer);
    const { bearer } = await createKey(athlete, ["plans:write", "exercises:write"]);
    const athleteId = athlete._id.toString();

    const plan = await api()
      .post(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", bearer)
      .send(planBody(exerciseId));
    expect(plan.status).toBe(403);
    expect(plan.body.code).toBe("permission_denied");

    const exercise = await api()
      .post("/api/v1/exercises")
      .set("Authorization", bearer)
      .send({ ...exerciseBody, name: "Eigene Übung" });
    expect(exercise.status).toBe(403);
  });

  it("Athlet mit ownPlan legt über den Key Pläne und private Übungen an", async () => {
    const { coach, athlete } = await coachWithAthlete(true);
    const exerciseId = await coachExercise(coach.bearer);
    const { bearer } = await createKey(athlete, ["plans:write", "exercises:write"]);
    const athleteId = athlete._id.toString();

    await api()
      .post(`/api/v1/athletes/${athleteId}/plans`)
      .set("Authorization", bearer)
      .send(planBody(exerciseId))
      .expect(201);
    await api()
      .post("/api/v1/exercises")
      .set("Authorization", bearer)
      .send({ ...exerciseBody, name: "Eigene Übung" })
      .expect(201);
  });

  it("Athleten-Key erreicht keine Daten anderer Athleten und keine Coach-Routen", async () => {
    const { athlete } = await coachWithAthlete(true);
    const { athlete: other } = await coachWithAthlete(true);
    const { bearer } = await createKey(athlete, ["plans:read", "workouts:read", "stats:read"]);

    const foreign = await api()
      .get(`/api/v1/athletes/${other._id.toString()}/plans`)
      .set("Authorization", bearer);
    expect(foreign.status).toBe(404);

    const coachRoute = await api()
      .get(`/api/v1/athletes/${athlete._id.toString()}/workout-logs`)
      .set("Authorization", bearer);
    expect(coachRoute.status).toBe(403);
    expect(coachRoute.body.code).toBe("forbidden");
  });

  it("Coach-Key listet Athleten, die Anamnese bleibt gesperrt", async () => {
    const { coach, athlete } = await coachWithAthlete();
    const { bearer } = await createKey(coach.user, ["athletes:read"]);

    const list = await api().get("/api/v1/athletes").set("Authorization", bearer);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);

    const detail = await api()
      .get(`/api/v1/athletes/${athlete._id.toString()}`)
      .set("Authorization", bearer);
    expect(detail.status).toBe(403);
    expect(detail.body.code).toBe("api_key_route_forbidden");
  });

  it("Moderation von Übungen bleibt der Web-App vorbehalten", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const exerciseId = await coachExercise(coach.bearer);
    const { bearer } = await createKey(coach.user, ["exercises:read", "exercises:write"]);

    for (const action of ["submit", "replace", "adopt"]) {
      const res = await api()
        .post(`/api/v1/exercises/${exerciseId}/${action}`)
        .set("Authorization", bearer)
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("api_key_route_forbidden");
    }
    await api()
      .post(`/api/v1/exercises/${exerciseId}/archive`)
      .set("Authorization", bearer)
      .expect(200);
  });

  it("Login-Sitzungen sind von Bereichen nicht betroffen", async () => {
    const athlete = await createAndLogin();
    await api().get("/api/v1/exercises/notices").set("Authorization", athlete.bearer).expect(200);
  });
});

describe("Audit", () => {
  it("protokolliert Schreibzugriffe ohne Inhalte, Lesezugriffe nicht", async () => {
    const coach = await createUser({ role: "coach" });
    const { id, bearer } = await createKey(coach, ["exercises:read", "exercises:write"]);

    await api().get("/api/v1/exercises").set("Authorization", bearer).expect(200);
    const created = await api()
      .post("/api/v1/exercises?source=app")
      .set("Authorization", bearer)
      .send({ ...exerciseBody, name: "Geheime Notiz" })
      .expect(201);

    // Der Eintrag wird nach dem Absenden der Antwort geschrieben.
    await expect.poll(() => ApiKeyAuditModel.countDocuments()).toBe(1);
    const [entry] = await ApiKeyAuditModel.find().lean();
    expect(entry).toMatchObject({
      method: "POST",
      path: "/api/v1/exercises",
      status: 201,
      userId: coach._id,
    });
    expect(entry!.apiKeyId.toString()).toBe(id);
    expect(JSON.stringify(entry)).not.toContain("Geheime Notiz");
    expect(created.body.name).toBe("Geheime Notiz");
  });

  it("protokolliert auch abgewiesene Schreibversuche", async () => {
    const athlete = await createUser();
    const { bearer } = await createKey(athlete, ["plans:read"]);

    await api()
      .post("/api/v1/auth/change-password")
      .set("Authorization", bearer)
      .send({})
      .expect(403);

    await expect.poll(() => ApiKeyAuditModel.countDocuments({ status: 403 })).toBe(1);
  });

  it("protokolliert keine Requests mit Login-Sitzung", async () => {
    const coach = await createAndLogin({ role: "coach" });
    await coachExercise(coach.bearer);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await ApiKeyAuditModel.countDocuments()).toBe(0);
  });
});

describe("Rate-Limit pro Key", () => {
  beforeEach(() => enforceRateLimitsInTests(true));
  afterEach(() => enforceRateLimitsInTests(false));

  it("hat einen eigenen Bucket mit dem Limit des Keys, die Web-App bleibt unberührt", async () => {
    const athlete = await createAndLogin();
    const first = await createKey(athlete.user, ["plans:read"], { rateLimit: 2 });
    const second = await createKey(athlete.user, ["plans:read"], { rateLimit: 2 });
    const me = (bearer: string) => api().get("/api/v1/auth/me").set("Authorization", bearer);

    await me(first.bearer).expect(200);
    await me(first.bearer).expect(200);
    const limited = await me(first.bearer);
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("rate_limited");

    await me(second.bearer).expect(200);
    await me(athlete.bearer).expect(200);
  });
});
