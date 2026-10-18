import type { AthletePermissions } from "@athletept/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rocket, Timer, Users } from "lucide-react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { athleteKeys } from "@/features/athletes/api";
import { useSession } from "@/features/auth/session";
import { buildUser } from "@/test/server";

import { PreviewButton } from "./preview-kit";
import type * as ReleaseNotes from "./release-notes";
import { openWhatsNew, releaseFor } from "./store";
import type { WhatsNewRelease } from "./types";
import { WhatsNew } from "./whats-new-dialog";

const releases: WhatsNewRelease[] = [
  {
    id: "test-2",
    version: "2.0",
    date: "2026-10-01",
    items: [
      {
        title: "Pausentimer",
        text: "Läuft automatisch.",
        icon: Timer,
        preview: <PreviewButton>Vorschau</PreviewButton>,
      },
      {
        title: "Nur für Coaches",
        text: "Athleten sehen das nicht.",
        icon: Users,
        roles: ["coach"],
      },
      {
        title: "Eigener Plan",
        text: "Nur mit freigegebenem eigenem Trainingsplan.",
        icon: Rocket,
        permissions: ["ownPlan"],
      },
      { title: "Schneller", text: "Alles lädt schneller.", icon: Rocket },
    ],
  },
  {
    id: "test-1",
    version: "1.0",
    date: "2026-01-01",
    items: [{ title: "Alt", text: "Älteres Release.", icon: Rocket }],
  },
];

const noPermissions: AthletePermissions = { ownPlan: false, ownWeek: false };

/** Berechtigungen sind schon geladen, damit der Dialog sofort entscheiden kann. */
function renderWhatsNew(
  path = "/dashboard",
  { permissions = noPermissions, list = releases } = {} as {
    permissions?: AthletePermissions;
    list?: WhatsNewRelease[];
  },
) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(athleteKeys.myPermissions(), permissions);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <WhatsNew releases={list} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function signIn(role: "athlete" | "coach" = "athlete") {
  const user = buildUser({ role });
  useSession.setState({ status: "authenticated", user, accessToken: "token" });
  return user;
}

describe("Was ist neu", () => {
  it("zeigt das neueste Release und blättert durch die Neuerungen", async () => {
    signIn();
    renderWhatsNew();

    const dialog = await screen.findByRole("dialog", { name: "Pausentimer" });
    expect(dialog).toHaveTextContent("Neu in Version 2.0");
    expect(dialog).toHaveTextContent("Vorschau");
    // Coach-Eintrag ist für Athleten ausgefiltert
    expect(dialog).toHaveTextContent("1 / 2");

    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("dialog", { name: "Schneller" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zurück" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Los geht’s" })).toBeInTheDocument();
  });

  it("öffnet nach dem Schließen nicht erneut von selbst, lässt sich aber wieder aufrufen", async () => {
    signIn();
    const first = renderWhatsNew();

    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Später" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("atp-whats-new")!)).toEqual({
      release: "test-2",
      dismissed: true,
    });

    // Neu laden: bleibt zu
    first.unmount();
    renderWhatsNew();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Über das Kontomenü wieder öffnen, beginnt bei der ersten Neuerung
    openWhatsNew();
    expect(await screen.findByRole("dialog", { name: "Pausentimer" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("öffnet für ein neues Release wieder", async () => {
    signIn();
    localStorage.setItem("atp-whats-new", JSON.stringify({ release: "test-1", dismissed: true }));
    renderWhatsNew();

    expect(await screen.findByRole("dialog", { name: "Pausentimer" })).toBeInTheDocument();
  });

  it("bleibt nach „Los geht’s“ auch mit einem anderen Konto zu", async () => {
    signIn();
    const first = renderWhatsNew();

    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await userEvent.click(screen.getByRole("button", { name: "Los geht’s" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    first.unmount();
    signIn();
    renderWhatsNew();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("übernimmt das alte „gesehen“ je Nutzer", () => {
    const user = signIn();
    localStorage.setItem(`atp-whats-new:${user.id}`, "test-2");
    renderWhatsNew();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stört nicht während eines laufenden Trainings", () => {
    signIn();
    renderWhatsNew("/workouts/abc");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("zeigt Einträge mit Berechtigung nur Athleten, die sie haben", async () => {
    signIn();
    renderWhatsNew("/dashboard", { permissions: { ownPlan: true, ownWeek: false } });

    expect(await screen.findByRole("dialog")).toHaveTextContent("1 / 3");
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("dialog", { name: "Eigener Plan" })).toBeInTheDocument();
  });

  it("fällt ohne Berechtigung auf das vorige Release zurück, wenn sonst nichts bleibt", async () => {
    signIn();
    const onlyOwnPlan: WhatsNewRelease[] = [
      { ...releases[0]!, id: "p", items: [releases[0]!.items[2]!] },
      releases[1]!,
    ];
    renderWhatsNew("/dashboard", { list: onlyOwnPlan });

    expect(await screen.findByRole("dialog", { name: "Alt" })).toBeInTheDocument();
  });

  it("filtert Releases und Einträge nach Rolle und Berechtigung", () => {
    const onlyCoach: WhatsNewRelease[] = [{ ...releases[0]!, id: "c", roles: ["coach"] }];

    expect(releaseFor("athlete", onlyCoach)).toBeNull();
    // Coaches haben keine Athleten-Berechtigungen.
    expect(releaseFor("coach", onlyCoach)?.items).toHaveLength(3);
    expect(releaseFor("athlete", releases)?.items.map((item) => item.title)).toEqual([
      "Pausentimer",
      "Schneller",
    ]);
    expect(
      releaseFor("athlete", releases, { ownPlan: true, ownWeek: false })?.items.map((x) => x.title),
    ).toEqual(["Pausentimer", "Eigener Plan", "Schneller"]);
  });
});

describe("Inhalte in release-notes.tsx", () => {
  it("haben eindeutige IDs, gültige Daten und stehen neueste zuerst", async () => {
    // Im Test-Setup global durch eine leere Liste ersetzt, hier die echten Inhalte prüfen.
    const { releaseNotes } = await vi.importActual<typeof ReleaseNotes>("./release-notes");

    const ids = releaseNotes.map((release) => release.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const release of releaseNotes) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(release.date).getTime())).toBe(false);
      expect(release.items.length).toBeGreaterThan(0);
      const titles = release.items.map((item) => item.title);
      expect(new Set(titles).size).toBe(titles.length);
    }

    const dates = releaseNotes.map((release) => release.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
