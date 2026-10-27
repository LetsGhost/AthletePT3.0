import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildUser, buildWorkoutSummary, server } from "@/test/server";

describe("Verlauf (Athlet)", () => {
  // Daten aus 2025, damit die Titel nicht „Diese/Letzte Woche“ werden.
  it("gruppiert nach Woche und lädt ältere Trainings nach", async () => {
    useSession.setState({
      status: "authenticated",
      user: buildUser({ role: "athlete" }),
      accessToken: "token",
    });
    const skipped = buildWorkoutSummary({
      id: "6acd3920c0072ec254663e02",
      date: "2025-10-13",
      dayName: "Unterkörper A",
      status: "skipped",
      rating: null,
      notes: "Erkältet",
    });
    const pages: Record<string, ReturnType<typeof buildWorkoutSummary>[]> = {
      "1": [buildWorkoutSummary({ id: "6acd3920c0072ec254663e01", date: "2025-10-15" }), skipped],
      // Inzwischen kam ein Training dazu: Seite 2 beginnt mit dem letzten von Seite 1.
      "2": [skipped, buildWorkoutSummary({ id: "6acd3920c0072ec254663e03", date: "2025-10-06" })],
    };
    // Seitengröße 10: „total“ auf Seite 1 größer melden, damit es eine zweite Seite gibt.
    server.use(
      http.get(apiUrl("/me/workout-logs"), ({ request }) => {
        const page = new URL(request.url).searchParams.get("page")!;
        return HttpResponse.json({ items: pages[page], total: page === "1" ? 11 : 3 });
      }),
    );
    renderApp("/workouts");

    const week42 = await screen.findByRole("region", { name: "KW 42" });
    expect(within(week42).getByText("1 Einheit · 4 Sätze")).toBeInTheDocument();
    expect(within(week42).getByText("Grund: Erkältet")).toBeInTheDocument();
    expect(within(week42).getByLabelText("Bewertung 8 von 10")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "KW 41" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ältere Trainings laden" }));
    expect(await screen.findByRole("region", { name: "KW 41" })).toBeInTheDocument();
    expect(screen.getAllByText("Unterkörper A")).toHaveLength(1);
  });
});
