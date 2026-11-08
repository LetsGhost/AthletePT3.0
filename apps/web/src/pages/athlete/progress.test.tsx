import type { ExerciseStatsListResponse } from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import {
  apiUrl,
  buildActivity,
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
    maxReps: { value: 10, date: "2026-10-09", logId: "6acd3920c0072ec254663e03", deviating: false },
    maxDurationSeconds: null,
  },
  change: null,
  trend: [10],
  bodyGroup: "back",
});

function mockStats(response: ExerciseStatsListResponse, path = "/me/exercise-stats") {
  server.use(http.get(apiUrl(path), () => HttpResponse.json(response)));
}

describe("Fortschritt (Athlet)", () => {
  it("zeigt die stärksten Übungen als Kacheln und verlinkt die Liste", async () => {
    signIn("athlete");
    mockStats({ items: [bench, pullUps], records: [bench] });
    renderApp("/fortschritt");

    const card = await screen.findByRole("region", { name: "Gewichtsanalyse" });
    const tiles = await within(card).findAllByRole("listitem");
    // Rekorde zuerst, mit den übrigen Übungen aufgefüllt.
    expect(tiles).toHaveLength(2);
    expect(tiles[1]).toHaveTextContent("Klimmzüge10 Wdh.");
    const tile = within(tiles[0]!).getByRole("link");
    expect(tile).toHaveAttribute("href", `/fortschritt/${bench.exerciseId}`);
    expect(tile).toHaveTextContent("Bankdrücken105 kg+5 % seit Mo., 5. Okt.");
    expect(within(card).getByRole("link", { name: "Alle 2 Übungen" })).toHaveAttribute(
      "href",
      "/fortschritt/uebungen",
    );
  });

  it("sucht, filtert und sortiert die Übungsliste", async () => {
    signIn("athlete");
    const squat = buildExerciseStatsSummary({
      exerciseId: "6acd3920c0072ec254663c03",
      exerciseName: "Kniebeuge",
      lastDate: "2026-10-01",
      bodyGroup: "legs",
      trend: [100, 120],
      change: { from: 100, to: 120, fromDate: "2026-09-01", percent: 20 },
    });
    mockStats({ items: [bench, pullUps, squat], records: [bench, squat] });
    renderApp("/fortschritt/uebungen");

    expect(await screen.findByRole("heading", { level: 1, name: "Übungen" })).toBeInTheDocument();
    await screen.findByRole("list", { name: "Übungen" });
    const names = () =>
      within(screen.getByRole("list", { name: "Übungen" }))
        .getAllByRole("listitem")
        .map((item) => within(item).getByRole("link").textContent?.split(/\d/)[0]);
    // Zuletzt trainiert zuerst (Reihenfolge der API).
    expect(names()).toEqual(["Bankdrücken", "Klimmzüge", "Kniebeuge"]);
    expect(
      within(screen.getByRole("list", { name: "Übungen" })).getAllByRole("listitem")[1],
    ).toHaveTextContent("Klimmzüge1 Einheit");
    expect(
      within(screen.getByRole("list", { name: "Übungen" })).getAllByRole("listitem")[1],
    ).toHaveTextContent("10 Wdh.");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sortieren" }), "change");
    expect(names()).toEqual(["Kniebeuge", "Bankdrücken", "Klimmzüge"]);

    const groups = screen.getByRole("group", { name: "Körperbereich" });
    expect(
      within(groups)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Alle", "Brust", "Rücken", "Beine"]);
    await userEvent.click(within(groups).getByRole("button", { name: "Beine" }));
    expect(names()).toEqual(["Kniebeuge"]);
    expect(screen.getByText("1 Übung")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox", { name: "Übung suchen" }), "bank");
    expect(screen.getByText("Keine Übung gefunden")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Suche zurücksetzen" }));
    expect(names()).toHaveLength(3);
  });

  it("erklärt, dass es noch keine Daten gibt", async () => {
    signIn("athlete");
    mockStats({ items: [], records: [] });
    renderApp("/fortschritt");

    expect(await screen.findByText("Noch keine Daten")).toBeInTheDocument();
  });

  it("zeigt Stand, Bestwerte, Diagramm und Einheiten einer Übung", async () => {
    signIn("athlete");
    server.use(
      http.get(apiUrl(`/me/exercise-stats/${bench.exerciseId}`), () =>
        HttpResponse.json(buildExerciseStatsDetail()),
      ),
    );
    renderApp(`/fortschritt/${bench.exerciseId}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Bankdrücken" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 Einheiten · zuletzt Mo., 12. Okt.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Aktueller Stand" })).toHaveTextContent(
      "Geschätztes Maximum105 kg+5 %seit Mo., 5. Okt. (100 kg)",
    );
    const info = screen.getByRole("button", { name: "Wie wird das berechnet?" });
    await userEvent.click(info);
    expect(info).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Epley-Formel/)).toBeVisible();

    const best = screen.getByRole("region", { name: "Bestwerte" });
    expect(best).toHaveTextContent("Geschätztes Maximum105 kgam Mo., 12. Okt.");
    expect(best).toHaveTextContent("Höchstes Gewicht82,5 kg");
    expect(best).toHaveTextContent("Meiste Wiederholungen8 Wdh.");

    expect(
      screen.getByRole("img", { name: "Diagramm Gesch. Max.: 5. Okt. 100 kg, 12. Okt. 105 kg" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Volumen" }));
    expect(
      screen.getByRole("img", { name: "Diagramm Volumen: 5. Okt. 1.920 kg, 12. Okt. 1.980 kg" }),
    ).toBeInTheDocument();

    const rows = within(screen.getByRole("region", { name: "Einheiten" })).getAllByRole("link");
    // Neueste zuerst, mit Link zum Training.
    expect(rows[0]).toHaveTextContent(
      "Mo., 12. Okt.Bester Satz 80 kg × 9 · 3 Sätze105 kggesch. Max.",
    );
    expect(rows[0]).toHaveAttribute("href", "/workouts/6acd3920c0072ec254663e02");
  });

  it("blendet abweichende Trainings auf Wunsch aus", async () => {
    signIn("athlete");
    const detail = buildExerciseStatsDetail();
    const urls: string[] = [];
    server.use(
      http.get(apiUrl(`/me/exercise-stats/${bench.exerciseId}`), ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({
          ...detail,
          sessions: detail.sessions.map((s) => ({ ...s, deviating: true })),
        });
      }),
    );
    renderApp(`/fortschritt/${bench.exerciseId}`);

    await userEvent.click(await screen.findByRole("switch", { name: "Abweichende ausblenden" }));

    expect(
      await screen.findByText("Alle Trainings sind als abweichend markiert"),
    ).toBeInTheDocument();
    expect(new URL(urls.at(-1)!).searchParams.get("excludeDeviating")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Einblenden" }));
    expect(screen.getByRole("switch", { name: "Abweichende ausblenden" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("meldet eine Übung ohne Trainings", async () => {
    signIn("athlete");
    server.use(http.get(apiUrl("/me/exercise-stats/:id"), () => problem(404, "not_found")));
    renderApp("/fortschritt/6acd3920c0072ec254663fff");

    expect(await screen.findByText("Keine Daten zu dieser Übung")).toBeInTheDocument();
  });
});

describe("Streak", () => {
  it("zeigt Streak, Trainingszeit und Kalender mit Wochenstatus", async () => {
    signIn("athlete");
    mockStats({ items: [], records: [] });
    renderApp("/fortschritt");

    expect(await screen.findByRole("heading", { name: "Oktober" })).toBeInTheDocument();
    expect(screen.getByText("2 Wochen")).toBeInTheDocument();
    expect(screen.getByText("3 h 5 min")).toBeInTheDocument();
    expect(screen.getByText("Trainingszeit · Ø 1 h 2 min")).toBeInTheDocument();

    const calendar = screen.getByRole("table", { name: "Trainingskalender Oktober" });
    expect(within(calendar).getAllByRole("button")).toHaveLength(4);
    expect(within(calendar).getByText("KW 40: Kein Training")).toBeInTheDocument();
    expect(within(calendar).getByText("KW 41: Trainiert (2 Trainings)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nächster Monat" })).toBeDisabled();

    await userEvent.click(
      within(calendar).getByRole("button", { name: /Montag, 12. Oktober 2026: 1 Training/ }),
    );
    expect(screen.getByRole("link", { name: /Tag A.*1 h 5 min/ })).toHaveAttribute(
      "href",
      "/workouts/6acd3920c0072ec254663e02",
    );
  });

  it("blättert in den Vormonat", async () => {
    signIn("athlete");
    mockStats({ items: [], records: [] });
    server.use(
      http.get(apiUrl("/me/activity"), ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get("month") === "2026-09"
            ? buildActivity({ month: "2026-09", days: [], workoutCount: 0 })
            : buildActivity(),
        ),
      ),
    );
    renderApp("/fortschritt");

    await userEvent.click(await screen.findByRole("button", { name: "Vorheriger Monat" }));
    expect(await screen.findByRole("heading", { name: "September" })).toBeInTheDocument();
    expect(
      screen.getByText("In diesem Monat noch kein abgeschlossenes Training."),
    ).toBeInTheDocument();
  });

  it.each(["/progress", "/entwicklung"])(
    "leitet alte Links (%s) auf /fortschritt um",
    async (path) => {
      signIn("athlete");
      mockStats({ items: [], records: [] });
      renderApp(path);

      expect(
        await screen.findByRole("heading", { level: 1, name: "Fortschritt" }),
      ).toBeInTheDocument();
    },
  );
});

describe("Entwicklung (Coach)", () => {
  const athleteId = "6acd3920c0072ec254663bd9";

  it("zeigt Streak und Gewichtsanalyse auf der Athletenseite", async () => {
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
          permissions: { ownPlan: false, ownWeek: false },
        }),
      ),
    );
    mockStats({ items: [bench], records: [bench] }, `/athletes/${athleteId}/exercise-stats`);
    renderApp(`/coach/athletes/${athleteId}`);

    const card = await screen.findByRole("region", { name: "Gewichtsanalyse" });
    expect(await within(card).findByRole("link", { name: /Bankdrücken/ })).toHaveAttribute(
      "href",
      `/coach/athletes/${athleteId}/entwicklung/${bench.exerciseId}`,
    );
    expect(within(card).getByRole("link", { name: "Zur Übungsliste" })).toHaveAttribute(
      "href",
      `/coach/athletes/${athleteId}/entwicklung`,
    );
    expect(screen.getByRole("heading", { name: "Streak" })).toBeInTheDocument();
  });

  it("verlinkt im Verlauf die Protokolle des Athleten", async () => {
    signIn("coach");
    server.use(
      http.get(apiUrl(`/athletes/${athleteId}/exercise-stats/${bench.exerciseId}`), () =>
        HttpResponse.json(buildExerciseStatsDetail()),
      ),
    );
    renderApp(`/coach/athletes/${athleteId}/entwicklung/${bench.exerciseId}`);

    const sessions = await screen.findByRole("region", { name: "Einheiten" });
    expect(within(sessions).getAllByRole("link")[0]).toHaveAttribute(
      "href",
      `/coach/athletes/${athleteId}/workouts/6acd3920c0072ec254663e02`,
    );
  });

  it("zeigt die Übungsliste des Athleten mit Links zur Entwicklung", async () => {
    signIn("coach");
    mockStats({ items: [bench], records: [bench] }, `/athletes/${athleteId}/exercise-stats`);
    renderApp(`/coach/athletes/${athleteId}/entwicklung`);

    const list = await screen.findByRole("list", { name: "Übungen" });
    expect(within(list).getByRole("link", { name: /Bankdrücken/ })).toHaveAttribute(
      "href",
      `/coach/athletes/${athleteId}/entwicklung/${bench.exerciseId}`,
    );
    expect(screen.getByRole("link", { name: "Zum Athleten" })).toHaveAttribute(
      "href",
      `/coach/athletes/${athleteId}`,
    );
  });
});
