import type { AdminApiKey, ApiKey, CreateApiKeyRequest } from "@athletept/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { api, createAndLogin, lastMailTo } from "../../../test/helpers";
import { ApiKeyAuditModel, ApiKeyModel } from "./api-key.model";

let admin: Awaited<ReturnType<typeof createAndLogin>>;

beforeEach(async () => {
  admin = await createAndLogin({ role: "sysadmin" });
});

async function createKey(email: string, overrides: Partial<CreateApiKeyRequest> = {}) {
  const res = await api()
    .post("/api/v1/api-keys")
    .set("Authorization", admin.bearer)
    .send({ email, name: "Trainings-Tracker", scopes: ["plans:read"], ...overrides });
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return {
    apiKey: res.body as AdminApiKey & { mailSent: boolean },
    token: lastMailTo(email).token,
  };
}

const pickup = (bearer: string, token: string, acceptDataAccess: unknown = true) =>
  api()
    .post("/api/v1/api-keys/pickup")
    .set("Authorization", bearer)
    .send({ token, acceptDataAccess });

/** Legt einen Key an, holt ihn ab und liefert den Bearer-Header für die App. */
async function activeKey(
  user: Awaited<ReturnType<typeof createAndLogin>>,
  overrides: Partial<CreateApiKeyRequest> = {},
) {
  const { apiKey, token } = await createKey(user.user.email, overrides);
  const res = await pickup(user.bearer, token).expect(200);
  return { id: apiKey.id, bearer: `Bearer ${res.body.key as string}` };
}

describe("API-Keys verwalten (Sysadmin)", () => {
  it("legt einen Key an und schickt den Abhol-Link, ohne den Key zu verraten", async () => {
    const athlete = await createAndLogin({ name: "Alex Athlet" });

    const { apiKey } = await createKey(athlete.user.email, {
      scopes: ["plans:read", "stats:read"],
    });

    expect(apiKey).toMatchObject({
      status: "pending",
      keyPreview: null,
      mailSent: true,
      scopes: ["plans:read", "stats:read"],
      rateLimit: 300,
      user: { id: athlete.user._id.toString(), name: "Alex Athlet", role: "athlete" },
    });
    expect(apiKey.pickupExpiresAt).not.toBeNull();
    expect(JSON.stringify(apiKey)).not.toMatch(/apt_|Hash/);
    const { mail } = lastMailTo(athlete.user.email);
    expect(mail.subject).toBe("Dein API-Zugang für AthletePT");
    expect(mail.text).toContain("„Trainings-Tracker“");
    expect(mail.text).toContain("/api-zugang#token=");
  });

  it("findet nur Coaches und Athleten", async () => {
    const other = await createAndLogin({ role: "sysadmin" });
    for (const email of ["niemand@example.com", other.user.email]) {
      const res = await api()
        .post("/api/v1/api-keys")
        .set("Authorization", admin.bearer)
        .send({ email, name: "App", scopes: ["plans:read"] });
      expect(res.status).toBe(404);
    }
  });

  it("ist nur für den Sysadmin", async () => {
    const coach = await createAndLogin({ role: "coach" });
    await api().get("/api/v1/api-keys").set("Authorization", coach.bearer).expect(403);
    await api()
      .post("/api/v1/api-keys")
      .set("Authorization", coach.bearer)
      .send({ email: coach.user.email, name: "App", scopes: ["plans:read"] })
      .expect(403);
  });

  it("listet Keys mit Nutzer und Nutzung", async () => {
    const athlete = await createAndLogin();
    const { bearer } = await activeKey(athlete);
    await api().get("/api/v1/me/plan").set("Authorization", bearer).expect(200);

    const res = await api().get("/api/v1/api-keys").set("Authorization", admin.bearer).expect(200);

    const [item] = res.body as AdminApiKey[];
    expect(item).toMatchObject({ status: "active", requestCount: 1 });
    expect(item!.keyPreview).toMatch(/^apt_/);
    expect(item!.lastUsedAt).not.toBeNull();
    expect(item!.pickupExpiresAt).toBeNull();
  });

  it("zeigt abgelaufene Keys als abgelaufen", async () => {
    const athlete = await createAndLogin();
    const { id } = await activeKey(athlete);
    await ApiKeyModel.updateOne({ _id: id }, { expiresAt: new Date(Date.now() - 1000) });

    const res = await api().get("/api/v1/api-keys").set("Authorization", admin.bearer).expect(200);
    expect((res.body as AdminApiKey[])[0]!.status).toBe("expired");
  });

  it("schränkt Bereiche ein, erweitert sie aber nie", async () => {
    const athlete = await createAndLogin();
    const { id, bearer } = await activeKey(athlete, { scopes: ["plans:read", "workouts:read"] });
    const patch = (body: object) =>
      api().patch(`/api/v1/api-keys/${id}`).set("Authorization", admin.bearer).send(body);

    const extended = await patch({ scopes: ["plans:read", "workouts:write"] });
    expect(extended.status).toBe(400);
    expect(extended.body.code).toBe("api_key_scope_extension");

    const narrowed = await patch({ scopes: ["plans:read"], name: "Neu", rateLimit: 50 });
    expect(narrowed.status).toBe(200);
    expect(narrowed.body).toMatchObject({ scopes: ["plans:read"], name: "Neu", rateLimit: 50 });

    const res = await api().get("/api/v1/me/workout-logs").set("Authorization", bearer);
    expect(res.body.code).toBe("api_key_scope_missing");
  });

  it("zieht Keys sofort zurück", async () => {
    const athlete = await createAndLogin();
    const { id, bearer } = await activeKey(athlete);

    const res = await api()
      .post(`/api/v1/api-keys/${id}/revoke`)
      .set("Authorization", admin.bearer)
      .expect(200);
    expect(res.body.status).toBe("revoked");

    const me = await api().get("/api/v1/auth/me").set("Authorization", bearer);
    expect(me.body.code).toBe("api_key_revoked");
    await api()
      .patch(`/api/v1/api-keys/${id}`)
      .set("Authorization", admin.bearer)
      .send({ name: "x" })
      .expect(404);
  });

  it("zeigt Schreibzugriffe im Audit", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const { id, bearer } = await activeKey(coach, { scopes: ["exercises:write"] });
    await api()
      .post("/api/v1/exercises")
      .set("Authorization", bearer)
      .send({
        name: "Kniebeuge",
        aliases: [],
        category: "compound",
        equipment: "barbell",
        primaryMuscles: ["quads"],
      })
      .expect(201);
    await expect.poll(() => ApiKeyAuditModel.countDocuments()).toBe(1);

    const res = await api()
      .get(`/api/v1/api-keys/${id}/audit`)
      .set("Authorization", admin.bearer)
      .expect(200);
    expect(res.body.items).toEqual([
      { method: "POST", path: "/api/v1/exercises", status: 201, createdAt: expect.any(String) },
    ]);
  });
});

describe("Abhol-Link", () => {
  it("zeigt App und Bereiche nur dem Empfänger", async () => {
    const athlete = await createAndLogin();
    const other = await createAndLogin();
    const { token } = await createKey(athlete.user.email, { scopes: ["workouts:write"] });
    const inspect = (bearer: string) =>
      api().post("/api/v1/api-keys/pickup/inspect").set("Authorization", bearer).send({ token });

    const own = await inspect(athlete.bearer).expect(200);
    expect(own.body).toMatchObject({ name: "Trainings-Tracker", scopes: ["workouts:write"] });

    const foreign = await inspect(other.bearer);
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe("api_key_pickup_wrong_user");
    await pickup(other.bearer, token).expect(403);

    await api().post("/api/v1/api-keys/pickup/inspect").send({ token }).expect(401);
    await pickup(admin.bearer, token).expect(403);
  });

  it("verlangt die Bestätigung des Datenzugriffs", async () => {
    const athlete = await createAndLogin();
    const { token } = await createKey(athlete.user.email);

    expect((await pickup(athlete.bearer, token, false)).status).toBe(400);
    const missing = await api()
      .post("/api/v1/api-keys/pickup")
      .set("Authorization", athlete.bearer)
      .send({ token });
    expect(missing.status).toBe(400);
    await pickup(athlete.bearer, token).expect(200);
  });

  it("liefert den Key genau einmal und merkt sich die Bestätigung", async () => {
    const athlete = await createAndLogin();
    const { apiKey, token } = await createKey(athlete.user.email);

    const first = await pickup(athlete.bearer, token).expect(200);
    expect(first.body.key).toMatch(/^apt_/);
    expect(first.body.apiKey).toMatchObject({ id: apiKey.id, status: "active" });

    const second = await pickup(athlete.bearer, token);
    expect(second.status).toBe(400);
    expect(second.body.code).toBe("invalid_token");

    const stored = await ApiKeyModel.findById(apiKey.id).lean();
    expect(stored?.dataAccessAcceptedAt).toBeInstanceOf(Date);
    expect(stored?.pickupTokenHash).toBeNull();
    await api()
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${first.body.key as string}`)
      .expect(200);
  });

  it("abgelaufene Links gelten nicht", async () => {
    const athlete = await createAndLogin();
    const { apiKey, token } = await createKey(athlete.user.email);
    await ApiKeyModel.updateOne({ _id: apiKey.id }, { pickupExpiresAt: new Date(Date.now() - 1) });

    expect((await pickup(athlete.bearer, token)).body.code).toBe("invalid_token");
  });

  it("ein neuer Link macht den alten ungültig, abgeholte Keys bekommen keinen", async () => {
    const athlete = await createAndLogin();
    const { apiKey, token: oldToken } = await createKey(athlete.user.email);

    const resend = await api()
      .post(`/api/v1/api-keys/${apiKey.id}/pickup-link`)
      .set("Authorization", admin.bearer)
      .expect(200);
    expect(resend.body).toEqual({ mailSent: true });
    const newToken = lastMailTo(athlete.user.email).token;
    expect(newToken).not.toBe(oldToken);

    expect((await pickup(athlete.bearer, oldToken)).body.code).toBe("invalid_token");
    await pickup(athlete.bearer, newToken).expect(200);

    const again = await api()
      .post(`/api/v1/api-keys/${apiKey.id}/pickup-link`)
      .set("Authorization", admin.bearer);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("api_key_not_pending");
  });

  it("ein zurückgezogener Key lässt sich nicht mehr abholen", async () => {
    const athlete = await createAndLogin();
    const { apiKey, token } = await createKey(athlete.user.email);
    await api()
      .post(`/api/v1/api-keys/${apiKey.id}/revoke`)
      .set("Authorization", admin.bearer)
      .expect(200);

    expect((await pickup(athlete.bearer, token)).body.code).toBe("invalid_token");
  });
});

describe("Eigene API-Keys", () => {
  it("listet nur eigene Keys und lässt sie zurückziehen", async () => {
    const athlete = await createAndLogin();
    const other = await createAndLogin();
    const { id, bearer } = await activeKey(athlete);
    const { id: otherId } = await activeKey(other);

    const list = await api()
      .get("/api/v1/me/api-keys")
      .set("Authorization", athlete.bearer)
      .expect(200);
    expect((list.body as ApiKey[]).map((k) => k.id)).toEqual([id]);

    await api()
      .post(`/api/v1/me/api-keys/${otherId}/revoke`)
      .set("Authorization", athlete.bearer)
      .expect(404);
    const revoked = await api()
      .post(`/api/v1/me/api-keys/${id}/revoke`)
      .set("Authorization", athlete.bearer)
      .expect(200);
    expect(revoked.body.status).toBe("revoked");
    expect((await api().get("/api/v1/auth/me").set("Authorization", bearer)).status).toBe(401);
  });

  it("Keys lassen sich nicht mit einem Key verwalten", async () => {
    const athlete = await createAndLogin();
    const { id, bearer } = await activeKey(athlete);

    for (const req of [
      api().get("/api/v1/me/api-keys"),
      api().post(`/api/v1/me/api-keys/${id}/revoke`),
      api().post("/api/v1/api-keys/pickup").send({ token: "x", acceptDataAccess: true }),
    ]) {
      const res = await req.set("Authorization", bearer);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("api_key_route_forbidden");
    }
  });
});
