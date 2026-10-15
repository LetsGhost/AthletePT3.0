import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { authResponse, buildUser, problem, server, apiUrl } from "@/test/server";

import { api } from "./api";
import { ApiError } from "./http";

function signedIn(accessToken = "expired-token") {
  useSession.setState({ status: "authenticated", user: buildUser(), accessToken });
}

describe("api", () => {
  it("sendet das Access-Token als Bearer", async () => {
    signedIn("valid-token");
    server.use(
      http.get(apiUrl("/ping"), ({ request }) =>
        HttpResponse.json({ auth: request.headers.get("authorization") }),
      ),
    );

    await expect(api("/ping")).resolves.toEqual({ auth: "Bearer valid-token" });
  });

  it("erneuert bei abgelaufenem Token die Sitzung und wiederholt den Request", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/ping"), ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh-token"
          ? HttpResponse.json({ ok: true })
          : problem(401, "token_expired"),
      ),
      http.post(apiUrl("/auth/refresh"), () =>
        HttpResponse.json(authResponse(buildUser(), "fresh-token")),
      ),
    );

    await expect(api("/ping")).resolves.toEqual({ ok: true });
    expect(useSession.getState().accessToken).toBe("fresh-token");
  });

  it("teilt sich bei parallelen Requests einen Refresh", async () => {
    signedIn();
    let refreshCalls = 0;
    server.use(
      http.get(apiUrl("/ping"), ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh-token"
          ? HttpResponse.json({ ok: true })
          : problem(401, "token_expired"),
      ),
      http.post(apiUrl("/auth/refresh"), () => {
        refreshCalls += 1;
        return HttpResponse.json(authResponse(buildUser(), "fresh-token"));
      }),
    );

    await Promise.all([api("/ping"), api("/ping"), api("/ping")]);

    expect(refreshCalls).toBe(1);
  });

  it("wiederholt den Refresh bei einem Rotationskonflikt", async () => {
    signedIn();
    let refreshCalls = 0;
    server.use(
      http.get(apiUrl("/ping"), ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh-token"
          ? HttpResponse.json({ ok: true })
          : problem(401, "token_expired"),
      ),
      http.post(apiUrl("/auth/refresh"), () => {
        refreshCalls += 1;
        return refreshCalls === 1
          ? problem(409, "refresh_conflict")
          : HttpResponse.json(authResponse(buildUser(), "fresh-token"));
      }),
    );

    await expect(api("/ping")).resolves.toEqual({ ok: true });
    expect(refreshCalls).toBe(2);
  });

  it("meldet ab, wenn die Sitzung nicht mehr erneuert werden kann", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/ping"), () => problem(401, "token_expired")),
      http.post(apiUrl("/auth/refresh"), () => problem(401, "session_expired")),
    );

    await expect(api("/ping")).rejects.toMatchObject({ code: "session_expired" });
    expect(useSession.getState().status).toBe("anonymous");
  });

  it("gibt Fachfehler unverändert weiter, ohne zu refreshen", async () => {
    signedIn("valid-token");
    server.use(http.get(apiUrl("/ping"), () => problem(403, "forbidden", "Keine Berechtigung")));

    const error = await api("/ping").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: "forbidden", message: "Keine Berechtigung" });
  });
});
