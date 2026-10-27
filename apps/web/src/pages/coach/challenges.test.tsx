import type { AthleteListResponse, CreateCoachChallengeRequest } from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildChallenge, buildUser, server } from "@/test/server";

function signIn() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "coach", name: "Clara Coach" }),
    accessToken: "token",
  });
}

const coachView = buildChallenge({ me: null, todayValue: null });
const coachStandings = coachView.standings.map((s) => ({ ...s, isMe: false }));

const athletes: AthleteListResponse = {
  items: [
    {
      id: "6acd3920c0072ec254663a01",
      name: "Max Muster",
      email: "max@example.com",
      status: "active",
      goal: null,
      focus: null,
      lastLoginAt: null,
      createdAt: "2026-03-01T10:00:00.000Z",
    },
    {
      id: "6acd3920c0072ec254663a09",
      name: "Alt Archiviert",
      email: "alt@example.com",
      status: "disabled",
      goal: null,
      focus: null,
      lastLoginAt: null,
      createdAt: "2026-03-01T10:00:00.000Z",
    },
  ],
  quota: { used: 1, limit: 5 },
};

describe("Challenges (Coach)", () => {
  it("lädt zum Anlegen der ersten Challenge ein", async () => {
    signIn();
    server.use(http.get(apiUrl("/athletes"), () => HttpResponse.json(athletes)));
    renderApp("/coach/challenges");

    expect(await screen.findByText("Noch keine eigene Challenge")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Challenge anlegen" })[0]).toHaveAttribute(
      "href",
      "/coach/challenges/new",
    );
  });

  it("listet Challenges mit Stand", async () => {
    signIn();
    server.use(
      http.get(apiUrl("/athletes"), () => HttpResponse.json(athletes)),
      http.get(apiUrl("/coach/challenges"), () =>
        HttpResponse.json({
          items: [
            { ...coachView, standings: undefined },
            buildChallenge({ id: "6acd3920c0072ec254663c97", title: "Winter", status: "planned" }),
          ],
        }),
      ),
    );
    renderApp("/coach/challenges");

    const row = await screen.findByRole("link", { name: /Team-Volumen Oktober/ });
    expect(row).toHaveAttribute("href", `/coach/challenges/${coachView.id}`);
    expect(row).toHaveTextContent("Vorn: Lena S. · 36,8 t");
    expect(screen.queryByText("Winter")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Geplant 1" }));
    expect(screen.getByRole("link", { name: /Winter/ })).toHaveTextContent("3 Athleten angemeldet");
  });

  it("legt über den Assistenten eine Challenge an", async () => {
    signIn();
    let body: CreateCoachChallengeRequest | null = null;
    server.use(
      http.get(apiUrl("/athletes"), () => HttpResponse.json(athletes)),
      http.post(apiUrl("/coach/challenges"), async ({ request }) => {
        body = (await request.json()) as CreateCoachChallengeRequest;
        return HttpResponse.json(coachView, { status: 201 });
      }),
      http.get(apiUrl(`/coach/challenges/${coachView.id}`), () =>
        HttpResponse.json({ ...coachView, standings: coachStandings }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/coach/challenges/new");

    await user.click(await screen.findByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Bitte wähle, was gemessen wird.");

    await user.click(screen.getByRole("radio", { name: /^Volumen/ }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.click(screen.getByRole("radio", { name: /^Team-Ziel/ }));
    await user.type(screen.getByRole("textbox", { name: "Ziel fürs ganze Team" }), "500000");
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.click(screen.getByRole("button", { name: "1 Woche" }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    const list = await screen.findByLabelText("Athleten");
    expect(within(list).queryByText("Alt Archiviert")).not.toBeInTheDocument();
    await user.click(within(list).getByRole("checkbox", { name: /Max Muster/ }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    const title = screen.getByRole("textbox", { name: "Titel" });
    expect(title).toHaveValue("Volumen-Challenge");
    await user.clear(title);
    await user.type(title, "Herbst-Volumen");
    await user.type(screen.getByRole("textbox", { name: "Preis (optional)" }), "Shaker");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(screen.getByText("Team-Ziel · 500 t")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Challenge starten" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Team-Volumen Oktober" }),
    ).toBeInTheDocument();
    expect(body).toMatchObject({
      title: "Herbst-Volumen",
      metric: "volume",
      scoring: "team_goal",
      goalValue: 500_000,
      participantIds: ["6acd3920c0072ec254663a01"],
      prize: "Shaker",
      exerciseId: null,
      manualMode: null,
    });
    expect(body!.endDate > body!.startDate).toBe(true);
  });

  it("beendet eine laufende Challenge vorzeitig", async () => {
    signIn();
    let ended = false;
    const current = () =>
      HttpResponse.json({
        ...coachView,
        standings: coachStandings,
        ...(ended && { status: "finished", endedEarly: true, endDate: "2026-10-15" }),
      });
    server.use(
      http.get(apiUrl(`/coach/challenges/${coachView.id}`), current),
      http.post(apiUrl(`/coach/challenges/${coachView.id}/end`), () => {
        ended = true;
        return current();
      }),
    );
    renderApp(`/coach/challenges/${coachView.id}`);

    await userEvent.click(await screen.findByRole("button", { name: "Vorzeitig beenden" }));
    await userEvent.click(screen.getByRole("button", { name: "Beenden" }));
    expect(await screen.findByText("vorzeitig beendet")).toBeInTheDocument();
    expect(ended).toBe(true);
    expect(screen.queryByRole("button", { name: "Bearbeiten" })).not.toBeInTheDocument();
  });
});
