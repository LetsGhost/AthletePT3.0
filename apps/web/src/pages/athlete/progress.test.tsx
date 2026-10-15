import type { ExerciseStatsListResponse } from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import {
  apiUrl,
  buildExerciseStatsDetail,
  buildExerciseStatsSummary,
  buildUser,
  problem,
  server,
} from "@/test/server";

function signIn(role: "athlete" | "coach") {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role, name: role === "coach" ? "Clara Coach" : "Max Muster" }),
    accessToken: "token",
  });
}

const bench = buildExerciseStatsSummary();
const pullUps = buildExerciseStatsSummary({
  exerciseId: "6acd3920c0072ec254663c02",
  exerciseName: "Klimmzüge",
  metric: "maxReps",
  sessionCount: 1,
  lastDate: "2026-10-09",
  best: {
    estimated1rm: null,
    topWeightKg: null,
    maxReps: { value: 10, date: "2026-10-09", logId: "6acd3920c0072ec254663e03" },
    maxDurationSeconds: null,
  },
  change: null,
});

function mockStats(response: ExerciseStatsListResponse, path = "/me/exercise-stats") {
  server.use(http.get(apiUrl(path), () => HttpResponse.json(response)));
}

describe("Fortschritt (Athlet)", () => {
  it("zeigt Rekorde und alle Übungen mit Veränderung", async () => {
    signIn("athlete");
    mockStats({ items: [bench, pullUps], records: [bench] });
    renderApp("/progress");

    const records = await screen.findByRole("region", { name: "Rekorde" });
    const record = within(records).getByRole("link", { name: /Bankdrücken/ });
    expect(record).toHaveAttribute("href", `/progress/${bench.exerciseId}`);
    expect(record).toHaveTextContent("105 kg");
    expect(record).toHaveTextContent("max. 82,5 kg");
    expect(record).toHaveTextContent("+5 % seit Mo., 5. Okt.");

    const all = screen.getByRole("region", { name: "Alle Übungen" });
    const items = within(all).getAllByRole("link");
    expect(items[0]).toHaveTextContent("Bankdrücken2 Einheiten · zuletzt Mo., 12. Okt.105 kg");
    expect(items[1]).toHaveTextContent("Klimmzüge1 Einheit");
    expect(items[1]).toHaveTextContent("10 Wdh.");
  });

  it("erklärt, dass es noch keine Daten gibt", async () => {
    signIn("athlete");
    mockStats({ items: [], records: [] });
    renderApp("/progress");

    expect(await screen.findByText("Noch keine Daten")).toBeInTheDocument();
  });

  it("zeigt Bestwerte, Diagramm und Einheiten einer Übung", async () => {
    signIn("athlete");
    server.use(
      http.get(apiUrl(`/me/exercise-stats/${bench.exerciseId}`), () =>
        HttpResponse.json(buildExerciseStatsDetail()),
      ),
    );
    renderApp(`/progress/${bench.exerciseId}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Bankdrücken" }),
    ).toBeInTheDocument();
    const best = screen.getByRole("region", { name: "Bestwerte" });
    expect(best).toHaveTextContent("Geschätztes Maximum105 kgam Mo., 12. Okt.");
    expect(best).toHaveTextContent("Höchstes Gewicht82,5 kg");
    expect(
      screen.getByRole("img", { name: /Diagramm: Geschätztes Maximum von 100 kg/ }),
    ).toBeInTheDocument();

    const rows = within(screen.getByRole("table", { name: "Einheiten" })).getAllByRole("row");
    // Neueste zuerst, mit Link zum Training.
    expect(rows[1]).toHaveTextContent("Mo., 12. Okt.105 kg82,5 kg1.980 kg3");
    expect(within(rows[1]!).getByRole("link")).toHaveAttribute(
      "href",
      "/workouts/6acd3920c0072ec254663e02",
    );
  });

  it("meldet eine Übung ohne Trainings", async () => {
    signIn("athlete");
    server.use(http.get(apiUrl("/me/exercise-stats/:id"), () => problem(404, "not_found")));
    renderApp("/progress/6acd3920c0072ec254663fff");

    expect(await screen.findByText("Keine Daten zu dieser Übung")).toBeInTheDocument();
  });
});

describe("Fortschritt (Coach)", () => {
  const athleteId = "6acd3920c0072ec254663bd9";

  it("zeigt den Fortschritt auf der Athletenseite und verlinkt den Verlauf", async () => {
    signIn("coach");
    server.use(
      http.get(apiUrl(`/athletes/${athleteId}`), () =>
        HttpResponse.json({
          id: athleteId,
          name: "Max Muster",
          email: "max@example.com",
          status: "active",
          goal: null,
          focus: null,
          lastLoginAt: null,
          createdAt: "2026-10-01T00:00:00.000Z",
          profile: {},
        }),
      ),
    );
    mockStats({ items: [bench], records: [bench] }, `/athletes/${athleteId}/exercise-stats`);
    renderApp(`/coach/athletes/${athleteId}`);

    const records = await screen.findByRole("region", { name: "Rekorde" });
    expect(within(records).getByRole("link", { name: /Bankdrücken/ })).toHaveAttribute(
      "href",
      `/coach/athletes/${athleteId}/progress/${bench.exerciseId}`,
    );
  });

  it("verlinkt im Verlauf die Protokolle des Athleten", async () => {
    signIn("coach");
    server.use(
      http.get(apiUrl(`/athletes/${athleteId}/exercise-stats/${bench.exerciseId}`), () =>
        HttpResponse.json(buildExerciseStatsDetail()),
      ),
    );
    renderApp(`/coach/athletes/${athleteId}/progress/${bench.exerciseId}`);

    const table = await screen.findByRole("table", { name: "Einheiten" });
    expect(within(table).getAllByRole("link")[0]).toHaveAttribute(
      "href",
      `/coach/athletes/${athleteId}/workouts/6acd3920c0072ec254663e02`,
    );
  });
});
