import type { MyPlanResponse } from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import {
  apiUrl,
  buildPlan,
  buildPlanExerciseInfo,
  buildUser,
  buildWorkoutLog,
  server,
} from "@/test/server";

function signInAsAthlete() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "athlete" }),
    accessToken: "token",
  });
}

function mockMyPlan(response: MyPlanResponse) {
  server.use(http.get(apiUrl("/me/plan"), () => HttpResponse.json(response)));
}

describe("Trainingsplan (Athlet)", () => {
  it("erklärt, dass noch kein Plan freigegeben ist", async () => {
    signInAsAthlete();
    mockMyPlan({ plan: null });
    renderApp("/plan");

    expect(await screen.findByText("Noch kein Trainingsplan")).toBeInTheDocument();
  });

  it("zeigt die Trainingstage und am Tag Warm-up, Sätze und die Anleitung", async () => {
    signInAsAthlete();
    mockMyPlan({
      plan: buildPlan({
        status: "active",
        notes: "Gewichte sind Richtwerte.",
        exercises: [
          buildPlanExerciseInfo({
            executionNotes: "Schulterblätter zusammenziehen",
            selectable: false,
          }),
        ],
      }),
    });
    const user = userEvent.setup();
    renderApp("/plan");

    const days = await screen.findByRole("list", { name: "Trainingstage" });
    expect(screen.queryByText("Gewichte sind Richtwerte.")).not.toBeInTheDocument();
    const day = within(days).getByRole("button", { name: /Oberkörper A/ });
    expect(day).toHaveTextContent("Montag");
    expect(day).toHaveTextContent("1 Übung");
    expect(day).toHaveAttribute("aria-expanded", "false");

    await user.click(day);
    expect(day).toHaveAttribute("aria-expanded", "true");
    expect(within(days).getByText("3 × 6–8 Wdh. · 80 kg · RIR 2")).toBeInTheDocument();
    await user.click(within(days).getByRole("link", { name: "Details zu Oberkörper A" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Oberkörper A" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Rudern")).toBeInTheDocument();
    expect(screen.getByText("Aufwärmen: 1 × 10 Wdh. · 40 kg")).toBeInTheDocument();
    expect(screen.getByText("3 × 6–8 Wdh. · 80 kg · RIR 2")).toBeInTheDocument();
    expect(screen.getByText("2 min Pause")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Anleitung zu Bankdrücken" }));
    expect(screen.getByRole("dialog", { name: "Bankdrücken" })).toHaveTextContent(
      "Schulterblätter zusammenziehen",
    );
  });

  it("zeigt das nächste Training mit Woche und sagt es schnell ab", async () => {
    signInAsAthlete();
    mockMyPlan({ plan: buildPlan({ status: "active" }) });
    let skipped: unknown;
    server.use(
      http.post(apiUrl("/me/workout-logs/skip"), async ({ request }) => {
        skipped = await request.json();
        return HttpResponse.json(buildWorkoutLog({ status: "skipped" }));
      }),
    );
    const user = userEvent.setup();
    renderApp("/plan");

    // Montag ist schon vorbei (heute Di 13.10.), also „noch offen“.
    const hero = await screen.findByRole("region", { name: "Oberkörper A" });
    expect(hero).toHaveTextContent("Noch offen");
    expect(hero).toHaveTextContent("Geplant für Montag, 12. Oktober");
    expect(hero).toHaveTextContent("~10 min");
    expect(within(hero).getByRole("button", { name: "Training starten" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Diese Woche" })).toHaveTextContent(
      "Dienstag (heute): frei",
    );

    await user.click(within(hero).getByRole("button", { name: "Heute nicht? Training absagen" }));
    const dialog = screen.getByRole("dialog", { name: "Oberkörper A absagen?" });
    await user.type(within(dialog).getByLabelText("Grund (optional)"), "Krank");
    await user.click(within(dialog).getByRole("button", { name: "Training absagen" }));

    expect(await screen.findByText("Oberkörper A abgesagt.")).toBeInTheDocument();
    expect(skipped).toEqual({ dayId: "6acd3920c0072ec254663d11", notes: "Krank" });
  });

  it("meldet einen unbekannten Trainingstag", async () => {
    signInAsAthlete();
    mockMyPlan({ plan: buildPlan({ status: "active" }) });
    renderApp("/plan/6acd3920c0072ec254663fff");

    expect(await screen.findByText("Trainingstag nicht gefunden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zum aktuellen Plan" })).toHaveAttribute(
      "href",
      "/plan",
    );
  });
});
