import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl, server } from "@/test/server";

import { logout } from "./session";

describe("logout", () => {
  it("löscht Trainingsentwürfe und Timer vom Gerät, andere Einstellungen bleiben", async () => {
    server.use(http.post(apiUrl("/auth/logout"), () => new HttpResponse(null, { status: 204 })));
    localStorage.setItem("athletept.workout.abc", "{}");
    localStorage.setItem("athletept.rest.abc", "{}");
    localStorage.setItem("athletept.theme", "dark");

    await logout();

    expect(localStorage.getItem("athletept.workout.abc")).toBeNull();
    expect(localStorage.getItem("athletept.rest.abc")).toBeNull();
    expect(localStorage.getItem("athletept.theme")).toBe("dark");
  });
});
