import type { AthleteDetail, AthleteListResponse } from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildUser, problem, server } from "@/test/server";

const athlete = (overrides: Partial<AthleteDetail> = {}): AthleteDetail => ({
  id: "6acd3920c0072ec254663bd9",
  name: "Max Muster",
  email: "max@example.com",
  status: "active",
  goal: "Kraft",
  focus: "Beine",
  lastLoginAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  profile: { goal: "Kraft", focus: "Beine" },
  permissions: { ownPlan: false, ownWeek: false },
  ...overrides,
});

function signInAsCoach() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "coach", name: "Clara Coach" }),
    accessToken: "token",
  });
}

function mockList(list: AthleteListResponse) {
  server.use(http.get(apiUrl("/athletes"), () => HttpResponse.json(list)));
}

describe("Athletenliste", () => {
  it("zeigt Athleten mit Kontingent und filtert archivierte aus", async () => {
    signInAsCoach();
    mockList({
      items: [
        athlete(),
        athlete({ id: "6acd3920c0072ec254663bda", name: "Alte Akte", status: "disabled" }),
      ],
      quota: { used: 1, limit: 5 },
    });
    renderApp("/coach/athletes");

    const list = await screen.findByRole("list", { name: "Athleten" });
    expect(within(list).getByText("Max Muster")).toBeInTheDocument();
    expect(within(list).queryByText("Alte Akte")).not.toBeInTheDocument();
    expect(screen.getByText(/von 5 Plätzen belegt/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Archiviert" }));
    expect(within(list).getByText("Alte Akte")).toBeInTheDocument();
  });

  it("sperrt die Einladung bei vollem Kontingent und erklärt warum", async () => {
    signInAsCoach();
    mockList({ items: [athlete()], quota: { used: 1, limit: 1 } });
    renderApp("/coach/athletes");

    const button = await screen.findByRole("button", { name: /Athlet einladen/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/Kontingent ist voll/);
  });

  it("zeigt einen Fehler mit Wiederholen-Knopf, wenn die Liste nicht lädt", async () => {
    signInAsCoach();
    server.use(http.get(apiUrl("/athletes"), () => problem(500, "internal_error")));
    renderApp("/coach/athletes");

    expect(await screen.findByText("Konnte nicht geladen werden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();
  });
});

describe("Athlet einladen", () => {
  it("schickt Stammdaten und Anamnese und öffnet danach die Detailseite", async () => {
    signInAsCoach();
    let body: unknown;
    server.use(
      http.post(apiUrl("/athletes"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { ...athlete({ status: "invited" }), inviteSent: true },
          { status: 201 },
        );
      }),
      http.get(apiUrl("/athletes"), () =>
        HttpResponse.json({ items: [athlete()], quota: { used: 1, limit: 5 } }),
      ),
    );
    const { router } = renderApp("/coach/athletes/new");

    await userEvent.type(await screen.findByLabelText(/^Name/), "Max Muster");
    await userEvent.type(screen.getByLabelText(/^E-Mail/), "max@example.com");
    await userEvent.type(screen.getByLabelText(/Größe/), "182");
    await userEvent.selectOptions(screen.getByLabelText("Geschlecht"), "male");
    await userEvent.click(screen.getByRole("button", { name: "Einladen" }));

    expect(await screen.findByRole("heading", { name: "Max Muster" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/coach/athletes/6acd3920c0072ec254663bd9");
    expect(body).toEqual({
      name: "Max Muster",
      email: "max@example.com",
      profile: { heightCm: 182, sex: "male" },
    });
  });

  it("zeigt Feldfehler vor dem Absenden", async () => {
    signInAsCoach();
    renderApp("/coach/athletes/new");

    await userEvent.type(await screen.findByLabelText(/Größe/), "viel");
    await userEvent.click(screen.getByRole("button", { name: "Einladen" }));

    expect(await screen.findByText("Name fehlt")).toBeInTheDocument();
    expect(screen.getByLabelText(/Größe/)).toHaveAttribute("aria-invalid", "true");
  });

  it("meldet eine bereits vergebene E-Mail", async () => {
    signInAsCoach();
    server.use(
      http.post(apiUrl("/athletes"), () =>
        problem(409, "email_taken", "Diese E-Mail-Adresse wird bereits verwendet"),
      ),
    );
    renderApp("/coach/athletes/new");

    await userEvent.type(await screen.findByLabelText(/^Name/), "Max");
    await userEvent.type(screen.getByLabelText(/^E-Mail/), "max@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Einladen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("bereits verwendet");
  });
});

describe("Fragebogen", () => {
  it("ist von der Einladung aus verlinkt und öffnet sich in einem neuen Tab", async () => {
    signInAsCoach();
    renderApp("/coach/athletes/new");

    const link = await screen.findByRole("link", { name: "Fragebogen als PDF" });
    expect(link).toHaveAttribute("href", "/coach/fragebogen");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("zeigt die Anamnese-Fragen ohne interne Notizen und ohne App-Rahmen", async () => {
    signInAsCoach();
    renderApp("/coach/fragebogen");

    expect(
      await screen.findByRole("heading", { name: "Fragebogen für dein Training" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gesundheit" })).toBeInTheDocument();
    expect(screen.getByText("Hast du körperliche Beschwerden oder Schmerzen?")).toBeInTheDocument();
    expect(screen.queryByText(/Interne Notizen/)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /als PDF speichern/ })).toBeInTheDocument();
  });
});
