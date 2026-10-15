import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  login,
  refreshSession,
  sessionExpired,
  updateSessionUser,
  useSession,
} from "@/features/auth/session";
import { apiUrl, authResponse, buildUser, server } from "@/test/server";

import { clearCacheOnUserChange, createQueryClient } from "./query-client";

const alice = buildUser({ id: "6acd3920c0072ec254663b01", name: "Alice" });
const bob = buildUser({ id: "6acd3920c0072ec254663b02", name: "Bob" });

describe("clearCacheOnUserChange", () => {
  const queryClient = createQueryClient();
  let unsubscribe: () => void;
  const cached = () => queryClient.getQueryCache().getAll().length;

  beforeEach(() => {
    unsubscribe = clearCacheOnUserChange(queryClient);
    useSession.setState({ status: "authenticated", user: alice, accessToken: "a" });
    queryClient.setQueryData(["workouts", "my-week", null], { owner: "alice" });
  });
  afterEach(() => {
    unsubscribe();
    queryClient.clear();
  });

  it("leert den Cache, wenn die Sitzung abläuft", () => {
    sessionExpired();
    expect(cached()).toBe(0);
  });

  it("leert den Cache beim Logout aus einem anderen Tab", async () => {
    new BroadcastChannel("atp-auth").postMessage("logout");
    await expect.poll(() => useSession.getState().user).toBeNull();
    expect(cached()).toBe(0);
  });

  it("leert den Cache, wenn sich ein anderer User anmeldet", async () => {
    server.use(http.post(apiUrl("/auth/login"), () => HttpResponse.json(authResponse(bob))));
    await login({ email: bob.email, password: "egal-egal-egal" });
    expect(cached()).toBe(0);
  });

  it("behält den Cache bei Refresh und Namensänderung desselben Users", async () => {
    server.use(
      http.post(apiUrl("/auth/refresh"), () => HttpResponse.json(authResponse(alice, "a2"))),
    );
    await refreshSession();
    updateSessionUser({ ...alice, name: "Alice Neu" });
    expect(cached()).toBe(1);
  });
});
