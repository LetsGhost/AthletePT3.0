import {
  exerciseSearchKey,
  type Exercise,
  type ExerciseListResponse,
  type UserRole,
} from "@athletept/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildExercise, buildUser, server } from "@/test/server";

const bank = buildExercise();
const pause = buildExercise({
  id: "6acd3920c0072ec254663c03",
  name: "Pause-Kniebeuge",
  primaryMuscles: ["quads"],
  secondaryMuscles: [],
  scope: "own",
});

function signIn(role: UserRole) {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role, name: "Clara Coach" }),
    accessToken: "token",
  });
}

/** Liefert die Liste und merkt sich die Filter-Parameter jeder Anfrage. */
function mockList(items: Exercise[]) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(apiUrl("/exercises"), ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      // Wie die API: Vergleich über den normalisierten Suchschlüssel.
      const search = exerciseSearchKey(params.get("search") ?? "");
      const scope = params.get("scope");
      const result = items.filter(
        (x) =>
          (!search || exerciseSearchKey(x.name).includes(search)) && (!scope || x.scope === scope),
      );
      return HttpResponse.json({
        items: result,
        total: result.length,
      } satisfies ExerciseListResponse);
    }),
  );
  return requests;
}

describe("Übungen (Coach)", () => {
  it("zeigt Katalog und eigene Übungen, globale nur zum Ansehen", async () => {
    signIn("coach");
    mockList([bank, pause]);
    renderApp("/coach/exercises");

    const list = await screen.findByRole("list", { name: "Übungen" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("2 Übungen")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Bankdrücken bearbeiten" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause-Kniebeuge bearbeiten" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Bankdrücken ansehen" }));
    const dialog = screen.getByRole("dialog", { name: "Bankdrücken" });
    expect(dialog).toHaveTextContent("Grundübung · Langhantel");
    expect(dialog).toHaveTextContent("Trizeps");
  });

  it("filtert nach Herkunft, Muskelgruppe und Suchbegriff", async () => {
    signIn("coach");
    const requests = mockList([bank, pause]);
    renderApp("/coach/exercises");
    await screen.findByRole("list", { name: "Übungen" });

    await userEvent.click(screen.getByRole("radio", { name: "Eigene" }));
    await waitFor(() => expect(screen.getByText("1 Übung")).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText("Muskelgruppe"), "quads");
    await userEvent.type(screen.getByRole("searchbox", { name: "Übungen suchen" }), "pause");

    await waitFor(() => {
      const last = requests.at(-1)!;
      expect(Object.fromEntries(last)).toMatchObject({
        scope: "own",
        muscle: "quads",
        search: "pause",
      });
    });
  });

  it("erklärt leere Suchergebnisse und setzt Filter zurück", async () => {
    signIn("coach");
    mockList([bank]);
    renderApp("/coach/exercises");
    await screen.findByRole("list", { name: "Übungen" });

    await userEvent.type(screen.getByRole("searchbox", { name: "Übungen suchen" }), "xyz");
    expect(await screen.findByText("Keine Übungen gefunden")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filter zurücksetzen" }));

    expect(await screen.findByRole("list", { name: "Übungen" })).toBeInTheDocument();
  });

  it("legt eine eigene Übung an und weist auf gleichnamige Katalog-Übungen hin", async () => {
    signIn("coach");
    mockList([bank]);
    let body: unknown;
    server.use(
      http.post(apiUrl("/exercises"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...pause, name: "Bankdrücken" }, { status: 201 });
      }),
    );
    renderApp("/coach/exercises");
    await userEvent.click(await screen.findByRole("button", { name: /Eigene Übung/ }));
    const dialog = screen.getByRole("dialog", { name: "Neue Übung" });

    // Ohne Pflichtangaben: Fehler an den Feldern.
    await userEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));
    expect(
      await within(dialog).findByText("Mindestens eine primäre Muskelgruppe wählen"),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Kategorie/)).toBeInvalid();

    const name = within(dialog).getByLabelText(/^Name/);
    await userEvent.type(name, "Bankdruecken");
    await waitFor(() =>
      expect(name).toHaveAccessibleDescription(/Im Katalog gibt es bereits „Bankdrücken“/),
    );
    await userEvent.type(within(dialog).getByLabelText(/^Synonyme/), "Bench Press, Flachbank");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Kategorie/), "compound");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Equipment/), "barbell");
    const primary = within(dialog).getByRole("group", { name: /Primäre Muskelgruppen/ });
    const secondary = within(dialog).getByRole("group", { name: /Sekundäre Muskelgruppen/ });
    await userEvent.click(within(primary).getByRole("checkbox", { name: "Brust" }));
    // Primär gewählt, also sekundär gesperrt.
    expect(within(secondary).getByRole("checkbox", { name: "Brust" })).toBeDisabled();
    await userEvent.click(within(secondary).getByRole("checkbox", { name: "Trizeps" }));
    await userEvent.type(within(dialog).getByLabelText(/^Video-Link/), "http://example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));
    expect(await within(dialog).findByText("Bitte einen https-Link angeben")).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText(/^Video-Link/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    expect(await screen.findByText("„Bankdrücken“ angelegt.")).toBeInTheDocument();
    expect(body).toEqual({
      name: "Bankdruecken",
      aliases: ["Bench Press", "Flachbank"],
      category: "compound",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: ["triceps"],
      description: null,
      executionNotes: null,
      videoUrl: null,
    });
  });
});

describe("Übungskatalog (Sysadmin)", () => {
  it("lässt globale Übungen bearbeiten und archivieren", async () => {
    signIn("sysadmin");
    mockList([bank]);
    let archived = false;
    server.use(
      http.post(apiUrl(`/exercises/${bank.id}/archive`), () => {
        archived = true;
        return HttpResponse.json({ ...bank, archived: true });
      }),
    );
    renderApp("/admin/exercises");

    expect(await screen.findByRole("heading", { name: "Übungskatalog" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Eigene" })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Bankdrücken bearbeiten" }));
    const dialog = screen.getByRole("dialog", { name: "Übung bearbeiten" });
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue("Bankdrücken");
    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));

    await userEvent.click(screen.getByRole("button", { name: "Bankdrücken archivieren" }));
    expect(await screen.findByText(/„Bankdrücken“ archiviert/)).toBeInTheDocument();
    expect(archived).toBe(true);
  });
});
