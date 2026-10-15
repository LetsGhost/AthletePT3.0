import type { Coach } from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildUser, server } from "@/test/server";

const coach = (overrides: Partial<Coach>): Coach => ({
  id: "6acd3920c0072ec254663bd1",
  email: "coach@example.com",
  name: "Coach",
  status: "active",
  athleteQuota: 5,
  athleteCount: 0,
  archivedAthleteCount: 0,
  lastLoginAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const clara = coach({
  id: "6acd3920c0072ec254663bd1",
  name: "Clara Coach",
  athleteCount: 2,
  archivedAthleteCount: 1,
});
const ben = coach({ id: "6acd3920c0072ec254663bd2", name: "Ben Berger", athleteCount: 1 });
const dora = coach({
  id: "6acd3920c0072ec254663bd3",
  name: "Dora Dorn",
  athleteQuota: 2,
  athleteCount: 1,
});
const gesperrt = coach({
  id: "6acd3920c0072ec254663bd4",
  name: "Gerd Gesperrt",
  status: "disabled",
});

function signInAsSysadmin() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "sysadmin", name: "Sam Admin" }),
    accessToken: "token",
  });
}

async function openEditDialog(name: string) {
  signInAsSysadmin();
  renderApp("/admin/coaches");
  await userEvent.click(await screen.findByRole("button", { name: `${name} bearbeiten` }));
  return screen.getByRole("dialog");
}

describe("Coach sperren", () => {
  it("lässt die Athleten an einen Coach mit genug freien Plätzen übergeben", async () => {
    let body: unknown;
    server.use(
      http.get(apiUrl("/coaches"), () => HttpResponse.json([ben, clara, dora, gesperrt])),
      http.patch(apiUrl(`/coaches/${clara.id}`), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...clara, status: "disabled", athleteCount: 0 });
      }),
    );
    const dialog = await openEditDialog("Clara Coach");

    expect(within(dialog).queryByLabelText(/Athleten übergeben an/)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Zugang sperren" }));

    const select = within(dialog).getByRole("combobox", { name: /Athleten übergeben an/ });
    expect(select).toHaveAccessibleDescription(
      /Übernimmt alle 3 Athleten von Clara Coach, davon 1 archiviert .* Benötigt 2 freie Plätze/,
    );
    // Nur aktive andere Coaches, zu volle sind nicht wählbar.
    const options = within(select).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Coach auswählen",
      "Ben Berger (4 frei)",
      "Dora Dorn (nur 1 frei, Kontingent reicht nicht)",
    ]);
    expect(options[2]).toBeDisabled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));
    expect(select).toHaveAccessibleDescription(/Bitte wähle einen Coach/);
    expect(body).toBeUndefined();

    await userEvent.selectOptions(select, ben.id);
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText(
        "Clara Coach ist gesperrt. 3 Athleten wurden an Ben Berger übergeben.",
      ),
    ).toBeInTheDocument();
    expect(body).toEqual({
      name: "Clara Coach",
      athleteQuota: 5,
      status: "disabled",
      reassignToCoachId: ben.id,
    });
  });

  it("zeigt Fehler der API direkt an der Auswahl", async () => {
    server.use(
      http.get(apiUrl("/coaches"), () => HttpResponse.json([ben, clara])),
      http.patch(apiUrl(`/coaches/${clara.id}`), () => {
        const detail = "Ben Berger hat nur 1 freien Platz, es kommen aber 2 Athleten dazu.";
        return HttpResponse.json(
          {
            type: "about:blank",
            title: "Conflict",
            status: 409,
            code: "quota_exceeded",
            detail,
            errors: [{ path: "reassignToCoachId", message: detail }],
          },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );
    const dialog = await openEditDialog("Clara Coach");

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Zugang sperren" }));
    const select = within(dialog).getByRole("combobox", { name: /Athleten übergeben an/ });
    await userEvent.selectOptions(select, ben.id);
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));

    expect(await within(dialog).findByText(/hat nur 1 freien Platz/)).toBeInTheDocument();
    expect(select).toBeInvalid();
  });

  it("sperrt Coaches ohne Athleten ohne Übergabe", async () => {
    let body: unknown;
    const withoutAthletes = { ...ben, athleteCount: 0 };
    server.use(
      http.get(apiUrl("/coaches"), () => HttpResponse.json([withoutAthletes, dora])),
      http.patch(apiUrl(`/coaches/${ben.id}`), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...withoutAthletes, status: "disabled" });
      }),
    );
    const dialog = await openEditDialog("Ben Berger");

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Zugang sperren" }));
    expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Änderungen gespeichert.")).toBeInTheDocument();
    expect(body).toEqual({ name: "Ben Berger", athleteQuota: 5, status: "disabled" });
  });
});
