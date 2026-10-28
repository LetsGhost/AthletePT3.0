import type { ChallengeEntryRequest, ChallengeWorkoutUpdate } from "@athletept/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { WorkoutChallenges } from "@/features/challenges/workout-challenges";
import { renderApp } from "@/test/render";
import { apiUrl, buildChallenge, buildUser, problem, server } from "@/test/server";

function signIn() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "athlete", name: "Max Muster" }),
    accessToken: "token",
  });
}

const running = buildChallenge();
const finished = buildChallenge({
  id: "6acd3920c0072ec254663c98",
  title: "September-Konstanz",
  metric: "workouts",
  status: "finished",
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  me: { ...running.me!, score: 12, rank: 1, achieved: true },
});

describe("Challenges (Athlet)", () => {
  it("zeigt laufende Challenges auf der Fortschritt-Seite", async () => {
    signIn();
    server.use(
      http.get(apiUrl("/me/exercise-stats"), () => HttpResponse.json({ items: [], records: [] })),
      http.get(apiUrl("/me/challenges"), () => HttpResponse.json({ items: [running, finished] })),
    );
    renderApp("/fortschritt");

    const card = await screen.findByRole("region", { name: "Challenges" });
    const link = await within(card).findByRole("link", { name: /Team-Volumen Oktober/ });
    expect(link).toHaveAttribute("href", `/challenges/${running.id}`);
    expect(link).toHaveTextContent("31,4 t");
    expect(link).toHaveTextContent("Platz 2 von 3");
    expect(within(card).queryByText("September-Konstanz")).not.toBeInTheDocument();
  });

  it("listet Challenges nach Status", async () => {
    signIn();
    server.use(
      http.get(apiUrl("/me/challenges"), () => HttpResponse.json({ items: [running, finished] })),
    );
    renderApp("/challenges");

    expect(await screen.findByRole("link", { name: /Team-Volumen Oktober/ })).toHaveTextContent(
      "noch 16 Tage",
    );
    await userEvent.click(screen.getByRole("radio", { name: /Abgeschlossen/ }));
    const done = screen.getByRole("link", { name: /September-Konstanz/ });
    expect(done).toHaveTextContent("12 Trainings");
    expect(done).toHaveTextContent("Sieg");
    await userEvent.click(screen.getByRole("radio", { name: /Entdecken/ }));
    expect(screen.getByText("Gerade gibt es keine neuen System-Challenges.")).toBeInTheDocument();
  });

  it("zeigt Stand, Preis und Rangliste", async () => {
    signIn();
    server.use(http.get(apiUrl(`/me/challenges/${running.id}`), () => HttpResponse.json(running)));
    renderApp(`/challenges/${running.id}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Team-Volumen Oktober" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Platz 2")).toBeInTheDocument();
    expect(screen.getByText("5,4 t hinter Lena S.")).toBeInTheDocument();
    expect(screen.getByText("Gratis-Session")).toBeInTheDocument();
    const standings = screen.getByRole("region", { name: "Rangliste" });
    const rows = within(standings).getAllByRole("listitem");
    expect(rows[1]).toHaveTextContent("Max Muster (du)31,4 t");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(screen.getByText(/Clara Coach hat dich angemeldet/)).toBeInTheDocument();
  });

  it("meldet eine unbekannte Challenge", async () => {
    signIn();
    server.use(
      http.get(apiUrl("/me/challenges/:id"), () => problem(404, "not_found", "Nicht gefunden")),
    );
    renderApp("/challenges/6acd3920c0072ec254663fff");
    expect(await screen.findByText("Challenge nicht gefunden")).toBeInTheDocument();
  });

  it("trägt eine Menge für heute ein", async () => {
    signIn();
    const manual = buildChallenge({
      title: "100 Klimmzüge am Tag",
      metric: "manual",
      manualMode: "quantity",
      dailyTarget: 100,
      scoring: "goal",
      goalValue: 10,
      todayValue: 60,
      entries: [{ date: "2026-10-15", value: 60 }],
    });
    const sent: number[] = [];
    server.use(
      http.get(apiUrl(`/me/challenges/${manual.id}`), () => HttpResponse.json(manual)),
      http.put(apiUrl(`/me/challenges/${manual.id}/entries/2026-10-15`), async ({ request }) => {
        const { value } = (await request.json()) as ChallengeEntryRequest;
        sent.push(value);
        return HttpResponse.json({ ...manual, todayValue: value });
      }),
    );
    renderApp(`/challenges/${manual.id}`);

    expect(await screen.findByText("Noch 40 bis zum Tagesziel")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "25 mehr" }));
    await userEvent.click(screen.getByRole("button", { name: "25 mehr" }));
    expect(screen.getByText("Tagesziel geschafft!")).toBeInTheDocument();
    // Mehrere schnelle Klicks ergeben einen einzigen Speichervorgang.
    await waitFor(() => expect(sent).toEqual([110]), { timeout: 2000 });
  });

  it("hakt eine Vorgabe ab", async () => {
    signIn();
    const check = buildChallenge({
      metric: "manual",
      manualMode: "check",
      scoring: "goal",
      goalValue: 10,
    });
    const sent: number[] = [];
    server.use(
      http.get(apiUrl(`/me/challenges/${check.id}`), () => HttpResponse.json(check)),
      http.put(apiUrl(`/me/challenges/${check.id}/entries/:date`), async ({ request }) => {
        const { value } = (await request.json()) as ChallengeEntryRequest;
        sent.push(value);
        return HttpResponse.json({ ...check, todayValue: value });
      }),
    );
    renderApp(`/challenges/${check.id}`);

    const toggle = await screen.findByRole("button", { name: "Heute erledigt" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
    expect(sent).toEqual([1]);
  });
});

describe("Challenges nach dem Training", () => {
  it("zeigt Zuwachs, neuen Platz und offene Einträge", () => {
    const update = (overrides: Partial<ChallengeWorkoutUpdate>): ChallengeWorkoutUpdate => ({
      id: "6acd3920c0072ec254663c99",
      kind: "coach",
      metric: "volume",
      scoring: "ranking",
      title: "Team-Volumen",
      goalValue: null,
      gained: 2_500,
      score: 31_400,
      teamScore: 70_000,
      rank: 2,
      previousRank: 4,
      participantCount: 6,
      entryPending: false,
      ...overrides,
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <WorkoutChallenges
            updates={[
              update({}),
              update({
                id: "6acd3920c0072ec254663c98",
                title: "100 Klimmzüge",
                metric: "manual",
                scoring: "goal",
                gained: 0,
                entryPending: true,
              }),
            ]}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const links = screen.getAllByRole("link", { name: /Team-Volumen|Klimmzüge/ });
    expect(links[0]).toHaveTextContent("+2,5 t · jetzt 31,4 t");
    expect(links[0]).toHaveTextContent("Platz 2");
    expect(links[0]).toHaveTextContent("2 Plätze nach oben");
    expect(links[1]).toHaveTextContent("Heute noch nicht eingetragen");
    expect(links[1]).toHaveTextContent("Eintragen");
  });
});
