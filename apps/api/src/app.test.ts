import { describe, expect, it } from "vitest";

import { api } from "../test/helpers";

describe("App", () => {
  it("meldet unbekannte Routen als Problem-Details", async () => {
    const res = await api().get("/api/v1/gibt-es-nicht");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 404, code: "route_not_found" });
  });

  it("liefert einen Healthcheck", async () => {
    const res = await api().get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", db: "connected" });
  });

  it("setzt eine Request-ID", async () => {
    const res = await api().get("/health");

    expect(res.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("erzeugt ein OpenAPI-Dokument mit allen Routen", async () => {
    const res = await api().get("/api/v1/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths)).toContain("/api/v1/auth/login");
  });
});
