import type { ApiKeyScope, CreatePlanRequest } from "@athletept/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { api, createAndLogin, createUser } from "../../../test/helpers";
import { sentMails } from "../../lib/mail/mailer";
import type { UserDocument } from "../users/user.model";
import { ApiKeyModel } from "./api-key.model";
import * as apiKeyService from "./api-key.service";

let admin: Awaited<ReturnType<typeof createAndLogin>>;

beforeEach(async () => {
  admin = await createAndLogin({ role: "sysadmin" });
});

const adminAuth = () => ({ userId: admin.user._id.toString(), role: "sysadmin" as const });

async function createKey(user: UserDocument, scopes: ApiKeyScope[], name = "Trainings-Tracker") {
  const pending = await apiKeyService.createApiKey(adminAuth(), {
    userId: user._id.toString(),
    name,
    scopes,
  });
  const { apiKey, key } = await apiKeyService.issueApiKey(pending._id.toString());
  return { id: apiKey._id.toString(), bearer: `Bearer ${key}` };
}

const DAY = 24 * 60 * 60 * 1000;

describe("Herkunft (lastWriteVia)", () => {
  async function setup() {
    const coach = await createAndLogin({ role: "coach" });
    const athlete = await createAndLogin({ coachId: coach.user._id });
    await api()
      .patch(`/api/v1/athletes/${athlete.user._id.toString()}`)
      .set("Authorization", coach.bearer)
      .send({ permissions: { ownPlan: true } })
      .expect(200);
    const exercise = await api()
      .post("/api/v1/exercises")
      .set("Authorization", coach.bearer)
      .send({
        name: "Kniebeuge",
        aliases: [],
        category: "compound",
        equipment: "barbell",
        primaryMuscles: ["quads"],
      })
      .expect(201);
    const app = await createKey(athlete.user, [
      "plans:write",
      "plans:read",
      "workouts:write",
      "exercises:write",
    ]);
    return { coach, athlete, exerciseId: exercise.body.id as string, app };
  }

  const planBody = (exerciseId: string): CreatePlanRequest => ({
    name: "Plan",
    days: [
      {
        name: "Tag A",
        weekday: 1,
        warmup: [],
        exercises: [{ exerciseId, sets: [{ kind: "working", repsMin: 8 }] }],
      },
    ],
  });

  it("merkt sich bei Plänen die App und vergisst sie nach einer Änderung in der Web-App", async () => {
    const { coach, athlete, exerciseId, app } = await setup();
    const base = `/api/v1/athletes/${athlete.user._id.toString()}/plans`;

    const created = await api()
      .post(base)
      .set("Authorization", app.bearer)
      .send(planBody(exerciseId))
      .expect(201);
    expect(created.body.lastWriteVia).toEqual({ appName: "Trainings-Tracker" });

    const list = await api().get(base).set("Authorization", coach.bearer).expect(200);
    expect(list.body.items[0].lastWriteVia).toEqual({ appName: "Trainings-Tracker" });

    const updated = await api()
      .put(`${base}/${created.body.id as string}`)
      .set("Authorization", coach.bearer)
      .send({ ...planBody(exerciseId), revision: created.body.revision })
      .expect(200);
    expect(updated.body.lastWriteVia).toBeNull();
  });

  it("kennzeichnet Trainings und private Übungen aus der App", async () => {
    const { athlete, coach, exerciseId, app } = await setup();
    const plan = await api()
      .post(`/api/v1/athletes/${athlete.user._id.toString()}/plans`)
      .set("Authorization", athlete.bearer)
      .send(planBody(exerciseId))
      .expect(201);
    expect(plan.body.lastWriteVia).toBeNull();
    await api()
      .post(
        `/api/v1/athletes/${athlete.user._id.toString()}/plans/${plan.body.id as string}/activate`,
      )
      .set("Authorization", coach.bearer)
      .expect(200);

    const started = await api()
      .post("/api/v1/me/workout-logs")
      .set("Authorization", app.bearer)
      .send({ dayId: plan.body.days[0].id })
      .expect(201);
    expect(started.body.lastWriteVia).toEqual({ appName: "Trainings-Tracker" });

    const exercise = await api()
      .post("/api/v1/exercises")
      .set("Authorization", app.bearer)
      .send({
        name: "Eigene Übung",
        aliases: [],
        category: "compound",
        equipment: "barbell",
        primaryMuscles: ["chest"],
      })
      .expect(201);
    expect(exercise.body.lastWriteVia).toEqual({ appName: "Trainings-Tracker" });
  });
});

describe("Erneuern", () => {
  it("legt einen neuen Key mit denselben Einstellungen an, der alte bleibt gültig", async () => {
    const athlete = await createAndLogin();
    const old = await createKey(athlete.user, ["plans:read", "stats:read"]);

    const res = await api()
      .post(`/api/v1/api-keys/${old.id}/renew`)
      .set("Authorization", admin.bearer)
      .expect(201);

    expect(res.body).toMatchObject({
      status: "pending",
      name: "Trainings-Tracker",
      scopes: ["plans:read", "stats:read"],
      renewedFromId: old.id,
      mailSent: true,
    });
    await api().get("/api/v1/auth/me").set("Authorization", old.bearer).expect(200);

    const again = await api()
      .post(`/api/v1/api-keys/${old.id}/renew`)
      .set("Authorization", admin.bearer);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("api_key_already_renewed");
  });

  it("zählt den abgelösten Key nicht aufs Limit", async () => {
    const athlete = await createUser();
    const keys = [];
    for (let i = 0; i < 3; i += 1) keys.push(await createKey(athlete, ["plans:read"]));

    await api()
      .post(`/api/v1/api-keys/${keys[0]!.id}/renew`)
      .set("Authorization", admin.bearer)
      .expect(201);
  });

  it("erneuert keine zurückgezogenen oder nicht abgeholten Keys", async () => {
    const athlete = await createUser();
    const revoked = await createKey(athlete, ["plans:read"]);
    await apiKeyService.revokeApiKey(revoked.id, admin.user._id.toString());
    const pending = await apiKeyService.createApiKey(adminAuth(), {
      userId: athlete._id.toString(),
      name: "App",
      scopes: ["plans:read"],
    });

    for (const id of [revoked.id, pending._id.toString()]) {
      const res = await api()
        .post(`/api/v1/api-keys/${id}/renew`)
        .set("Authorization", admin.bearer);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("api_key_not_renewable");
    }
  });
});

describe("Hinweis vor dem Ablauf", () => {
  it("schickt 14 Tage vorher genau eine Mail", async () => {
    const athlete = await createUser({ email: "alex@example.com" });
    const soon = await createKey(athlete, ["plans:read"], "Bald weg");
    const later = await createKey(athlete, ["plans:read"], "Noch lange");
    await ApiKeyModel.updateOne({ _id: soon.id }, { expiresAt: new Date(Date.now() + 10 * DAY) });
    await ApiKeyModel.updateOne({ _id: later.id }, { expiresAt: new Date(Date.now() + 20 * DAY) });

    expect(await apiKeyService.sendExpiryNotices()).toBe(1);
    expect(await apiKeyService.sendExpiryNotices()).toBe(0);

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0]).toMatchObject({
      to: "alex@example.com",
      subject: "Dein API-Zugang läuft bald ab",
    });
    expect(sentMails[0]!.text).toContain("„Bald weg“");
  });

  it("überspringt bereits erneuerte, abgelaufene und zurückgezogene Keys", async () => {
    const athlete = await createUser();
    const renewed = await createKey(athlete, ["plans:read"]);
    const expired = await createKey(athlete, ["plans:read"]);
    await ApiKeyModel.updateOne({ _id: renewed.id }, { expiresAt: new Date(Date.now() + 5 * DAY) });
    await ApiKeyModel.updateOne({ _id: expired.id }, { expiresAt: new Date(Date.now() - DAY) });
    await apiKeyService.renewApiKey(adminAuth(), renewed.id);
    sentMails.length = 0;

    const revoked = await apiKeyService.createApiKey(adminAuth(), {
      userId: athlete._id.toString(),
      name: "Weg",
      scopes: ["plans:read"],
    });
    await apiKeyService.revokeApiKey(revoked._id.toString(), admin.user._id.toString());

    expect(await apiKeyService.sendExpiryNotices()).toBe(0);
    expect(sentMails).toHaveLength(0);
  });
});

describe("Doku für externe Apps", () => {
  it("enthält nur Routen, die mit Keys erreichbar sind, und ist mit Key abrufbar", async () => {
    const athlete = await createUser();
    const { bearer } = await createKey(athlete, ["plans:read"]);

    const res = await api().get("/api/v1/api-keys/openapi.json").set("Authorization", bearer);

    expect(res.status).toBe(200);
    const paths = Object.keys(res.body.paths as object);
    expect(paths).toContain("/api/v1/athletes/{athleteId}/plans");
    expect(paths).toContain("/api/v1/me/workout-logs");
    expect(paths).not.toContain("/api/v1/auth/login");
    expect(paths).not.toContain("/api/v1/api-keys");
    expect(paths).not.toContain("/api/v1/exercises/{id}/replace");
    expect(paths).not.toContain("/api/v1/athletes/{id}");
    expect(res.body.info.description).toContain("Bearer apt_");

    await api().get("/api/v1/api-keys/openapi.json").expect(401);
  });
});
