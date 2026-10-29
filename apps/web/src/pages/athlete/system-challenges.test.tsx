import type {
  BadgeListResponse,
  ChallengeDetail,
  CreateSystemTemplateRequest,
  UpdateChallengeSettingsRequest,
} from "@athletept/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildChallenge, buildUser, server } from "@/test/server";

function signIn(role: "athlete" | "sysadmin" = "athlete") {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role, name: role === "athlete" ? "Max Muster" : "Sam Sysadmin" }),
    accessToken: "token",
  });
}

const ROUND = "6acd3920c0072ec254663f01";

function buildRound(joined: boolean): ChallengeDetail {
  const others = [
    { athleteId: "6acd3920c0072ec254663a11", name: "IronLena", score: 22, rank: 1 },
    { athleteId: "6acd3920c0072ec254663a12", name: "Kettlebell_K", score: 21, rank: 2 },
    { athleteId: "6acd3920c0072ec254663a13", name: "Nordlicht", score: 20, rank: 3 },
    { athleteId: "6acd3920c0072ec254663a14", name: "GymRatte", score: 14, rank: 86 },
  ].map((s) => ({ ...s, achieved: true, isMe: false, tier: "gold" as const }));
  const me = {
    athleteId: "6acd3920c0072ec254663a01",
    name: "Max Muster",
    score: 14,
    rank: 87,
    achieved: true,
    isMe: true,
    tier: "silver" as const,
  };
  return buildChallenge({
    id: ROUND,
    kind: "system",
    metric: "workouts",
    scoring: "goal",
    title: "Monats-Konstanz · Oktober",
    prize: null,
    ownerName: null,
    goalValue: 8,
    tiers: [8, 12, 16],
    participantCount: 1284,
    joined,
    me: joined ? me : null,
    leader: others[0]!,
    standings: joined ? [...others, me] : others,
  });
}

describe("System-Challenges (Athlet)", () => {
  it("tritt nach Wahl eines Spitznamens bei", async () => {
    signIn();
    let joined = false;
    let nickname: string | null = null;
    server.use(
      http.get(apiUrl("/me/challenges/discover"), () =>
        HttpResponse.json({ items: joined ? [] : [buildRound(false)] }),
      ),
      http.get(apiUrl(`/me/challenges/${ROUND}`), () => HttpResponse.json(buildRound(joined))),
      http.get(apiUrl("/me/challenge-settings"), () =>
        HttpResponse.json({ nickname, challengeMails: true }),
      ),
      http.get(apiUrl("/me/challenge-settings/nickname-check"), ({ request }) => {
        const name = new URL(request.url).searchParams.get("nickname");
        return HttpResponse.json(
          name === "Max"
            ? { available: false, suggestions: ["Max_M", "MaxLifts"] }
            : { available: true, suggestions: [] },
        );
      }),
      http.put(apiUrl("/me/challenge-settings"), async ({ request }) => {
        nickname = ((await request.json()) as UpdateChallengeSettingsRequest).nickname ?? null;
        return HttpResponse.json({ nickname, challengeMails: true });
      }),
      http.post(apiUrl(`/me/challenges/${ROUND}/join`), () => {
        joined = true;
        return HttpResponse.json(buildRound(true));
      }),
    );
    const user = userEvent.setup();
    renderApp("/challenges");

    await user.click(await screen.findByRole("radio", { name: /Entdecken/ }));
    const card = screen.getByRole("link", { name: /Monats-Konstanz/ });
    expect(card).toHaveTextContent("1284 dabei");
    await user.click(card);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Monats-Konstanz · Oktober" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Abzeichen-Stufen" })).toHaveTextContent(
      "Bronzeab 8 TrainingsSilberab 12 TrainingsGoldab 16 Trainings",
    );
    await user.click(screen.getByRole("button", { name: "Beitreten" }));

    const dialog = await screen.findByRole("dialog", { name: "Wähle deinen Spitznamen" });
    await user.type(within(dialog).getByRole("textbox", { name: "Spitzname" }), "Max");
    expect(await within(dialog).findByText("„Max“ ist leider schon vergeben.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Max_M" }));
    expect(await within(dialog).findByText("„Max_M“ ist frei.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Beitreten" }));

    await waitFor(() => expect(joined).toBe(true));
    expect(nickname).toBe("Max_M");
    expect(await screen.findByText("Platz 87")).toBeInTheDocument();
    expect(screen.getByText("Noch 2 Trainings bis Gold")).toBeInTheDocument();
    const ranking = screen.getByRole("region", { name: "Rangliste" });
    expect(ranking).toHaveTextContent("···");
    expect(screen.getByRole("button", { name: "Challenge verlassen" })).toBeInTheDocument();
  });

  it("zeigt Abzeichen mit Stufen und Details", async () => {
    signIn();
    const badges: BadgeListResponse = {
      earnedCount: 1,
      items: [
        {
          id: "streak",
          group: "series",
          name: "Serien-Starter",
          description: "Trainiere mehrere Wochen am Stück.",
          icon: "flame",
          challengeKind: null,
          challengeId: null,
          tier: "silver",
          thresholds: ["2 Wo.", "4 Wo.", "8 Wo."],
          progress: "Silber · 5 Wochen am Stück",
        },
        {
          id: "duelist",
          group: "challenges",
          name: "Duellant",
          description: "Gewinne Duelle.",
          icon: "duel",
          challengeKind: "duel",
          challengeId: null,
          tier: null,
          thresholds: ["1", "5", "15"],
          progress: "Noch offen · 0 Siege",
        },
      ],
    };
    server.use(http.get(apiUrl("/me/badges"), () => HttpResponse.json(badges)));
    renderApp("/abzeichen");

    expect(await screen.findByText(/1 von 2 verdient/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Challenges" }));
    expect(screen.queryByRole("button", { name: /Serien-Starter/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Alle" }));
    await userEvent.click(screen.getByRole("button", { name: /Serien-Starter/ }));
    const dialog = screen.getByRole("dialog", { name: "Serien-Starter" });
    expect(dialog).toHaveTextContent("Silber · 5 Wochen am Stück");
    expect(dialog).toHaveTextContent("Gold8 Wo.");
  });

  it("schaltet Challenge-Mails in den Einstellungen ab", async () => {
    signIn();
    let body: UpdateChallengeSettingsRequest | null = null;
    server.use(
      http.get(apiUrl("/me/challenge-settings"), () =>
        HttpResponse.json({ nickname: "Max_M", challengeMails: true }),
      ),
      http.put(apiUrl("/me/challenge-settings"), async ({ request }) => {
        body = (await request.json()) as UpdateChallengeSettingsRequest;
        return HttpResponse.json({ nickname: "Max_M", challengeMails: false });
      }),
    );
    renderApp("/settings");

    expect(await screen.findByText("Max_M")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "E-Mails zu Challenges" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
    expect(body).toEqual({ challengeMails: false });
  });
});

describe("System-Challenges (Sysadmin)", () => {
  it("legt eine wöchentliche Vorlage an, Volumen in Tonnen", async () => {
    signIn("sysadmin");
    let body: CreateSystemTemplateRequest | null = null;
    server.use(
      http.post(apiUrl("/admin/system-challenges"), async ({ request }) => {
        body = (await request.json()) as CreateSystemTemplateRequest;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/system-challenges/new");

    await user.type(await screen.findByRole("textbox", { name: "Name" }), "Wochen-Volumen");
    await user.click(screen.getByRole("radio", { name: /Bewegte kg/ }));
    await user.click(screen.getByRole("radio", { name: "Wöchentlich" }));
    await user.click(screen.getByRole("button", { name: "Veröffentlichen" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "System-Challenges" }),
    ).toBeInTheDocument();
    expect(body).toEqual({
      title: "Wochen-Volumen",
      description: null,
      metric: "volume",
      tiers: [10_000, 20_000, 30_000],
      rhythm: "weekly",
      startDate: null,
      endDate: null,
      status: "active",
    });
  });

  it("verlangt aufsteigende Stufen", async () => {
    signIn("sysadmin");
    const user = userEvent.setup();
    renderApp("/admin/system-challenges/new");
    await user.type(await screen.findByRole("textbox", { name: "Name" }), "Falsch");
    const bronze = screen.getByRole("textbox", { name: "Bronze" });
    await user.clear(bronze);
    await user.type(bronze, "20");
    await user.click(screen.getByRole("button", { name: "Als Entwurf speichern" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Bronze < Silber < Gold");
  });
});
