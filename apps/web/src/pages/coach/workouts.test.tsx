import type {
  AthleteDetail,
  UpdateWeeklyActivitiesRequest,
  WorkoutLogListResponse,
} from "@athletept/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import {
  apiUrl,
  buildUser,
  buildWeekView,
  buildWorkoutLog,
  buildWorkoutSummary,
  server,
} from "@/test/server";

const athleteId = "6acd3920c0072ec254663bd9";

const athlete = {
  id: athleteId,
  name: "Max Muster",
  email: "max@example.com",
  status: "active",
  goal: null,
  focus: null,
  lastLoginAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  profile: {},
} satisfies AthleteDetail;

function signInAsCoach() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "coach", name: "Clara Coach" }),
    accessToken: "token",
  });
}

function mockAthlete() {
  server.use(http.get(apiUrl(`/athletes/${athleteId}`), () => HttpResponse.json(athlete)));
}

describe("Training des Athleten (Coach)", () => {
  it("zeigt Woche und Protokolle auf der Athletenseite", async () => {
    signInAsCoach();
    mockAthlete();
    const log = buildWorkoutSummary({ rating: 9, notes: "Lief gut" });
    server.use(
      http.get(apiUrl(`/athletes/${athleteId}/week`), () =>
        HttpResponse.json(
          buildWeekView({
            plan: { id: "6acd3920c0072ec254663d01", name: "Block 1" },
            days: [
              {
                dayId: log.dayId,
                name: "Oberkörper A",
                type: "UPPER",
                weekday: 1,
                status: "completed",
                logs: [log],
              },
            ],
            activities: [null, "Laufen", null, null, null, null, null],
            completedCount: 1,
            plannedCount: 1,
          }),
        ),
      ),
      http.get(apiUrl(`/athletes/${athleteId}/workout-logs`), () =>
        HttpResponse.json({
          items: [
            log,
            buildWorkoutSummary({
              id: "6acd3920c0072ec254663e02",
              status: "skipped",
              notes: "Krank",
              rating: null,
            }),
          ],
          total: 2,
        } satisfies WorkoutLogListResponse),
      ),
    );
    renderApp(`/coach/athletes/${athleteId}`);

    const days = await screen.findByRole("list", { name: "Wochentage" });
    expect(within(days).getByRole("link", { name: /Oberkörper A/ })).toHaveAttribute(
      "href",
      `/coach/athletes/${athleteId}/workouts/${log.id}`,
    );
    expect(within(days).getByText("Laufen")).toBeInTheDocument();

    const list = await screen.findByRole("list", { name: "Trainings von Max Muster" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("4 Sätze · Bewertung 9/10");
    expect(items[0]).toHaveTextContent("„Lief gut“");
    expect(items[1]).toHaveTextContent("Abgesagt");
    expect(items[1]).toHaveTextContent("Krank");
  });

  it("zeigt leere Zustände ohne Plan und Protokolle", async () => {
    signInAsCoach();
    mockAthlete();
    renderApp(`/coach/athletes/${athleteId}`);

    expect(await screen.findByText("Noch keine Trainings")).toBeInTheDocument();
    const days = await screen.findByRole("list", { name: "Wochentage" });
    expect(within(days).getAllByText("Frei")).toHaveLength(7);
  });

  it("bearbeitet den Wochenplan", async () => {
    signInAsCoach();
    mockAthlete();
    let saved: UpdateWeeklyActivitiesRequest | null = null;
    server.use(
      http.put(apiUrl(`/athletes/${athleteId}/weekly-activities`), async ({ request }) => {
        saved = (await request.json()) as UpdateWeeklyActivitiesRequest;
        return HttpResponse.json(saved);
      }),
    );
    const user = userEvent.setup();
    renderApp(`/coach/athletes/${athleteId}`);

    await user.click(await screen.findByRole("button", { name: "Wochenplan" }));
    const dialog = await screen.findByRole("dialog", { name: "Wochenplan bearbeiten" });
    await user.type(within(dialog).getByLabelText("Mittwoch"), "Laufen");
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(saved).toEqual({ activities: ["", "", "Laufen", "", "", "", ""] }));
    expect(await screen.findByText("Wochenplan gespeichert.")).toBeInTheDocument();
  });

  it("zeigt ein Protokoll mit Vorgabe und Geschafftem", async () => {
    signInAsCoach();
    const base = buildWorkoutLog();
    const log = buildWorkoutLog({
      status: "completed",
      editable: false,
      rating: 7,
      notes: "Schwer heute",
      completedAt: "2026-10-13T18:00:00.000Z",
      editableUntil: "2026-10-20T18:00:00.000Z",
      exercises: base.exercises.map((x) => ({
        ...x,
        notes: "Schulter ok",
        sets: [
          ...x.sets.map((s) => ({ ...s, done: true })),
          { kind: "working" as const, weightKg: 60, reps: 12, durationSeconds: null, done: true },
        ],
      })),
    });
    server.use(
      http.get(apiUrl(`/athletes/${athleteId}/workout-logs/${log.id}`), () =>
        HttpResponse.json(log),
      ),
    );
    renderApp(`/coach/athletes/${athleteId}/workouts/${log.id}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Oberkörper A" }),
    ).toBeInTheDocument();
    expect(screen.getByText("7 von 10")).toBeInTheDocument();
    expect(screen.getByText("Schwer heute")).toBeInTheDocument();
    const rows = within(screen.getByRole("table", { name: "Sätze Bankdrücken" })).getAllByRole(
      "row",
    );
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveTextContent("1 · Aufw.10 Wdh. · 40 kg40 kg × 10");
    expect(rows[5]).toHaveTextContent("5–60 kg × 12");
    expect(screen.getByText("Schulter ok")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
