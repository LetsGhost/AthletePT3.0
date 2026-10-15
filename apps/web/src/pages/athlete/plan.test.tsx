import type { MyPlanResponse } from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildPlan, buildPlanExerciseInfo, buildUser, server } from "@/test/server";

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
    expect(screen.getByText("Gewichte sind Richtwerte.")).toBeInTheDocument();
    const day = within(days).getByRole("link", { name: /Oberkörper A/ });
    expect(day).toHaveTextContent("Montag");
    expect(day).toHaveTextContent("1 Übung");

    await user.click(day);

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
