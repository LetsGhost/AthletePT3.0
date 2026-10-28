import type {
  ChallengeDetail,
  CreateDuelRequest,
  DuelInfo,
  NotificationListResponse,
} from "@athletept/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildChallenge, buildUser, server } from "@/test/server";

function signIn() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "athlete", name: "Max Muster" }),
    accessToken: "token",
  });
}

const MAX = "6acd3920c0072ec254663a01";
const LENA = "6acd3920c0072ec254663a02";

function buildDuel(duel: Partial<DuelInfo> = {}, overrides: Partial<ChallengeDetail> = {}) {
  const standings = [
    { athleteId: MAX, name: "Max Muster", score: 3, rank: 1, achieved: null, isMe: true },
    { athleteId: LENA, name: "Lena B.", score: 2, rank: 2, achieved: null, isMe: false },
  ];
  return buildChallenge({
    id: "6acd3920c0072ec254663d01",
    kind: "duel",
    metric: "training_days",
    title: "Meiste Trainingstage",
    prize: null,
    ownerName: null,
    startDate: "2026-10-12",
    endDate: "2026-10-25",
    participantCount: 2,
    teamScore: 5,
    standings,
    leader: standings[0]!,
    me: standings[0]!,
    daily: [
      { athleteId: MAX, date: "2026-10-12", value: 1 },
      { athleteId: LENA, date: "2026-10-13", value: 1 },
    ],
    duel: {
      state: "active",
      iAmChallenger: true,
      durationDays: 14,
      expiresAt: "2026-10-15T09:00:00.000Z",
      invitedEmail: null,
      opponentName: "Lena B.",
      gaveUpName: null,
      ...duel,
    },
    ...overrides,
  });
}

describe("Duelle (Athlet)", () => {
  it("fordert in drei Schritten per E-Mail heraus", async () => {
    signIn();
    let body: CreateDuelRequest | null = null;
    server.use(
      http.get(apiUrl("/me/exercise-stats"), () => HttpResponse.json({ items: [], records: [] })),
      http.post(apiUrl("/me/duels"), async ({ request }) => {
        body = (await request.json()) as CreateDuelRequest;
        return HttpResponse.json(
          buildDuel(
            {
              state: "pending",
              invitedEmail: "lena@example.com",
              opponentName: null,
              durationDays: 7,
            },
            { metric: "volume", title: "Meistes Volumen", status: "planned" },
          ),
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderApp("/challenges/duell");

    await user.click(await screen.findByRole("radio", { name: /Meistes Volumen/ }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.click(screen.getByRole("radio", { name: /1 Woche/ }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.click(screen.getByRole("button", { name: "Einladung senden" }));
    expect(screen.getByRole("alert")).toHaveTextContent("gültige E-Mail");
    await user.type(
      screen.getByRole("textbox", { name: "E-Mail des Gegners" }),
      "lena@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Einladung senden" }));

    expect(await screen.findByText("Einladung ist unterwegs")).toBeInTheDocument();
    expect(screen.getByText("1 Woche · wartet auf Antwort")).toBeInTheDocument();
    expect(body).toEqual({
      metric: "volume",
      exerciseId: null,
      durationDays: 7,
      email: "lena@example.com",
    });
  });

  it("zeigt den Stand im Duell und erlaubt Aufgeben", async () => {
    signIn();
    let gaveUp = false;
    const current = () =>
      HttpResponse.json(
        gaveUp
          ? buildDuel(
              { state: "finished", gaveUpName: "Max Muster" },
              {
                status: "finished",
                standings: [
                  {
                    athleteId: LENA,
                    name: "Lena B.",
                    score: 2,
                    rank: 1,
                    achieved: true,
                    isMe: false,
                  },
                  {
                    athleteId: MAX,
                    name: "Max Muster",
                    score: 3,
                    rank: 2,
                    achieved: false,
                    isMe: true,
                  },
                ],
              },
            )
          : buildDuel(),
      );
    server.use(
      http.get(apiUrl("/me/challenges/:id"), current),
      http.post(apiUrl("/me/duels/:id/give-up"), () => {
        gaveUp = true;
        return current();
      }),
    );
    renderApp("/challenges/6acd3920c0072ec254663d01");

    expect(await screen.findByLabelText("3 zu 2 Trainingstage")).toBeInTheDocument();
    expect(screen.getByText("Du führst mit 1 Trainingstag")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Verlauf pro Tag" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Aufgeben" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Lena B. gewinnt dann sofort.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Aufgeben" }));
    expect(await screen.findByText("Du hast aufgegeben, Lena B. gewinnt.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revanche fordern" })).toBeInTheDocument();
  });

  it("nimmt eine Einladung an", async () => {
    signIn();
    let accepted = false;
    const current = () =>
      HttpResponse.json(
        accepted
          ? buildDuel({ iAmChallenger: false, opponentName: "Tim K." })
          : buildDuel(
              { state: "pending", iAmChallenger: false, opponentName: "Tim K." },
              { status: "planned", standings: [], me: null, leader: null, daily: [] },
            ),
      );
    server.use(
      http.get(apiUrl("/me/challenges/:id"), current),
      http.post(apiUrl("/me/duels/:id/accept"), () => {
        accepted = true;
        return current();
      }),
    );
    renderApp("/challenges/6acd3920c0072ec254663d01");

    expect(
      await screen.findByRole("heading", { name: "Tim K. fordert dich heraus" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 Wochen")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Annehmen" }));
    expect(await screen.findByText("Du führst mit 1 Trainingstag")).toBeInTheDocument();
  });

  it("zeigt eingegangene Einladungen oben und lehnt sie ab", async () => {
    signIn();
    let declined = false;
    const invitation = buildDuel(
      {
        state: "pending",
        iAmChallenger: false,
        opponentName: "Tim K.",
        expiresAt: new Date(Date.now() + 50 * 3_600_000).toISOString(),
      },
      { status: "planned" },
    );
    server.use(
      http.get(apiUrl("/me/challenges"), () =>
        HttpResponse.json({ items: declined ? [] : [invitation] }),
      ),
      http.post(apiUrl("/me/duels/:id/decline"), () => {
        declined = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp("/challenges");

    const card = await screen.findByRole("region", { name: "Einladung von Tim K." });
    expect(card).toHaveTextContent("Meiste Trainingstage · 2 Wochen · Einladung noch 2 Tage");
    // Eingegangene Einladungen stehen nicht noch einmal unter „Geplant“.
    expect(screen.getByRole("radio", { name: /Geplant/ })).toHaveTextContent("0");
    await userEvent.click(within(card).getByRole("button", { name: "Ablehnen" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Einladung von Tim K." }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("Benachrichtigungen", () => {
  const inbox: NotificationListResponse = {
    unreadCount: 1,
    items: [
      {
        id: "6acd3920c0072ec254663e11",
        kind: "duel_invite",
        title: "Tim K. fordert dich zum Duell",
        text: "Meistes Volumen · 1 Woche",
        challengeId: "6acd3920c0072ec254663d01",
        challengeKind: "duel",
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: "6acd3920c0072ec254663e12",
        kind: "challenge_finished",
        title: "Team-Volumen: gewonnen!",
        text: "Platz 1 von 6",
        challengeId: "6acd3920c0072ec254663c99",
        challengeKind: "coach",
        read: true,
        createdAt: "2026-09-01T10:00:00.000Z",
      },
    ],
  };

  it("zeigt die Anzahl an der Glocke, gruppiert und markiert alles als gelesen", async () => {
    signIn();
    let read = false;
    server.use(
      http.get(apiUrl("/me/notifications"), () =>
        HttpResponse.json(
          read ? { unreadCount: 0, items: inbox.items.map((n) => ({ ...n, read: true })) } : inbox,
        ),
      ),
      http.post(apiUrl("/me/notifications/read-all"), () => {
        read = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp("/benachrichtigungen");

    expect(
      (await screen.findAllByRole("link", { name: "Benachrichtigungen, 1 neu" })).length,
    ).toBeGreaterThan(0);
    const today = await screen.findByRole("region", { name: "Heute" });
    expect(today).toHaveTextContent("Tim K. fordert dich zum Duell");
    expect(within(today).getByRole("link", { name: "Einladung ansehen" })).toHaveAttribute(
      "href",
      "/challenges/6acd3920c0072ec254663d01",
    );
    expect(screen.getByRole("region", { name: "Älter" })).toHaveTextContent("Platz 1 von 6");

    await userEvent.click(screen.getByRole("button", { name: "Alle gelesen" }));
    expect(await screen.findByText("Alles gelesen")).toBeInTheDocument();
  });

  it("erklärt den leeren Zustand", async () => {
    signIn();
    renderApp("/benachrichtigungen");
    expect(await screen.findByText("Alles erledigt")).toBeInTheDocument();
  });
});
