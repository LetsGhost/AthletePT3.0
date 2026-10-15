import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api, createAndLogin } from "../../test/helpers";
import { enforceRateLimitsInTests } from "./rate-limit";

/** Verbleibende Requests laut `RateLimit`-Header (draft-8: `"1000-in-15min"; r=999; t=900`). */
function remaining(res: { headers: Record<string, string> }) {
  const match = /;\s*r=(\d+)/.exec(res.headers.ratelimit ?? "");
  if (!match) throw new Error(`Kein RateLimit-Header: ${res.headers.ratelimit}`);
  return Number(match[1]);
}

describe("apiLimiter", () => {
  beforeEach(() => enforceRateLimitsInTests(true));
  afterEach(() => enforceRateLimitsInTests(false));

  it("zählt angemeldete Nutzer derselben IP getrennt und getrennt vom anonymen Traffic", async () => {
    const alice = await createAndLogin();
    const bob = await createAndLogin();
    const me = (bearer?: string) => {
      const req = api().get("/api/v1/auth/me");
      return bearer ? req.set("Authorization", bearer) : req;
    };

    const anonymousBefore = remaining(await me());
    for (let i = 0; i < 5; i += 1) await me(alice.bearer);
    const aliceAfter = remaining(await me(alice.bearer));
    const bobAfter = remaining(await me(bob.bearer));
    const anonymousAfter = remaining(await me());

    expect(bobAfter - aliceAfter).toBe(5);
    expect(anonymousBefore - anonymousAfter).toBe(1);
  });

  it("zählt ungültige Tokens wie anonymen Traffic", async () => {
    const anonymousBefore = remaining(await api().get("/api/v1/auth/me"));
    await api().get("/api/v1/auth/me").set("Authorization", "Bearer kaputt");
    const anonymousAfter = remaining(await api().get("/api/v1/auth/me"));

    expect(anonymousBefore - anonymousAfter).toBe(2);
  });
});
