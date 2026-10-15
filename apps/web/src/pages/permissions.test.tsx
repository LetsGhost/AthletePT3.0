import type {
  AthleteDetail,
  AthletePermissions,
  CreatePlanRequest,
  MyPlanResponse,
  PlanListResponse,
  UpdateAthleteRequest,
  UpdateWeeklyActivitiesRequest,
} from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildPlan, buildUser, server } from "@/test/server";

const athleteUser = buildUser({ role: "athlete", coachId: "6acd3920c0072ec254663bd7" });

function signIn(role: "athlete" | "coach") {
  useSession.setState({
    status: "authenticated",
    user: role === "athlete" ? athleteUser : buildUser({ role: "coach", name: "Clara Coach" }),
    accessToken: "token",
  });
}

function mockPermissions(permissions: AthletePermissions) {
  server.use(http.get(apiUrl("/me/permissions"), () => HttpResponse.json(permissions)));
}

describe("Berechtigungen (Coach)", () => {
  it("schaltet „Eigener Trainingsplan“ für den Athleten frei", async () => {
    signIn("coach");
    const athlete: AthleteDetail = {
      id: "6acd3920c0072ec254663bd9",
      name: "Max Muster",
      email: "max@example.com",
      status: "active",
      goal: null,
      focus: null,
      lastLoginAt: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      profile: {},
      permissions: { ownPlan: false, ownWeek: false },
    };
    const requests: UpdateAthleteRequest[] = [];
    server.use(
      http.get(apiUrl(`/athletes/${athlete.id}`), () => HttpResponse.json(athlete)),
      http.patch(apiUrl(`/athletes/${athlete.id}`), async ({ request }) => {
        const body = (await request.json()) as UpdateAthleteRequest;
        requests.push(body);
        return HttpResponse.json({
          ...athlete,
          permissions: { ...athlete.permissions, ...body.permissions },
        } satisfies AthleteDetail);
      }),
    );
    const user = userEvent.setup();
    renderApp(`/coach/athletes/${athlete.id}`);

    const ownPlan = await screen.findByRole("checkbox", { name: "Eigener Trainingsplan" });
    const ownWeek = screen.getByRole("checkbox", { name: "Eigene Trainingswoche" });
    expect(ownPlan).not.toBeChecked();
    expect(ownWeek).not.toBeChecked();

    await user.click(ownPlan);

    expect(requests).toEqual([{ permissions: { ownPlan: true } }]);
    expect(await screen.findByRole("checkbox", { name: "Eigener Trainingsplan" })).toBeChecked();
    expect(ownWeek).not.toBeChecked();
  });
});

describe("Eigener Trainingsplan (Athlet)", () => {
  it("zeigt ohne Berechtigung keine Planverwaltung", async () => {
    signIn("athlete");
    server.use(
      http.get(apiUrl("/me/plan"), () =>
        HttpResponse.json({ plan: null } satisfies MyPlanResponse),
      ),
    );
    renderApp("/plan");

    expect(await screen.findByText(/Sobald dein Coach einen Plan/)).toBeInTheDocument();
    expect(screen.queryByText("Meine Trainingspläne")).not.toBeInTheDocument();
  });

  it("legt einen eigenen Plan an und öffnet ihn ohne Vorlagen", async () => {
    signIn("athlete");
    mockPermissions({ ownPlan: true, ownWeek: false });
    const created = buildPlan({
      id: "6acd3920c0072ec254663d05",
      athleteId: athleteUser.id,
      name: "Mein Block",
      createdBy: "athlete",
    });
    const requests: CreatePlanRequest[] = [];
    server.use(
      http.get(apiUrl("/me/plan"), () =>
        HttpResponse.json({ plan: null } satisfies MyPlanResponse),
      ),
      http.get(apiUrl(`/athletes/${athleteUser.id}/plans`), () =>
        HttpResponse.json({ items: [] } satisfies PlanListResponse),
      ),
      http.post(apiUrl(`/athletes/${athleteUser.id}/plans`), async ({ request }) => {
        requests.push((await request.json()) as CreatePlanRequest);
        return HttpResponse.json(created, { status: 201 });
      }),
      http.get(apiUrl(`/athletes/${athleteUser.id}/plans/${created.id}`), () =>
        HttpResponse.json(created),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/plan");

    await user.click(await screen.findByRole("button", { name: "Ersten Plan anlegen" }));
    const dialog = screen.getByRole("dialog", { name: "Neuer Plan" });
    expect(within(dialog).queryByLabelText("Vorlage")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Name/), "Mein Block");
    await user.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Mein Block" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/plans/${created.id}`);
    expect(requests).toEqual([{ name: "Mein Block", days: [] }]);
    expect(screen.getByRole("button", { name: "Aktivieren" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Als Vorlage/ })).not.toBeInTheDocument();
  });
});

describe("Eigene Trainingswoche (Athlet)", () => {
  it("bearbeitet den Wochenplan über die eigene ID", async () => {
    signIn("athlete");
    mockPermissions({ ownPlan: false, ownWeek: true });
    const requests: UpdateWeeklyActivitiesRequest[] = [];
    server.use(
      http.put(apiUrl(`/athletes/${athleteUser.id}/weekly-activities`), async ({ request }) => {
        const body = (await request.json()) as UpdateWeeklyActivitiesRequest;
        requests.push(body);
        return HttpResponse.json({ activities: body.activities });
      }),
    );
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.click(await screen.findByRole("button", { name: "Wochenplan" }));
    const dialog = screen.getByRole("dialog", { name: "Wochenplan bearbeiten" });
    expect(dialog).toHaveTextContent("Was machst du außer dem Krafttraining");
    await user.type(within(dialog).getByLabelText("Dienstag"), "Laufen");
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Wochenplan gespeichert.")).toBeInTheDocument();
    expect(requests).toEqual([{ activities: ["", "Laufen", "", "", "", "", ""] }]);
  });

  it("zeigt ohne Berechtigung keinen Bearbeiten-Knopf", async () => {
    signIn("athlete");
    renderApp("/dashboard");

    expect(await screen.findByText("Trainingswoche")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wochenplan" })).not.toBeInTheDocument();
  });
});
