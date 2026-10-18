import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rocket, Timer, Users } from "lucide-react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

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

function renderWhatsNew(path = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WhatsNew releases={releases} />
    </MemoryRouter>,
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
    const user = signIn();
    const first = renderWhatsNew();

    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Später" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(`atp-whats-new:${user.id}`)).toBe("test-2");

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
    const user = signIn();
    localStorage.setItem(`atp-whats-new:${user.id}`, "test-1");
    renderWhatsNew();

    expect(await screen.findByRole("dialog", { name: "Pausentimer" })).toBeInTheDocument();
  });

  it("stört nicht während eines laufenden Trainings", () => {
    signIn();
    renderWhatsNew("/workouts/abc");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filtert Releases und Einträge nach Rolle", () => {
    const onlyCoach: WhatsNewRelease[] = [{ ...releases[0]!, id: "c", roles: ["coach"] }];

    expect(releaseFor("athlete", onlyCoach)).toBeNull();
    expect(releaseFor("coach", onlyCoach)?.items).toHaveLength(3);
    expect(releaseFor("athlete", releases)?.items.map((item) => item.title)).toEqual([
      "Pausentimer",
      "Schneller",
    ]);
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
