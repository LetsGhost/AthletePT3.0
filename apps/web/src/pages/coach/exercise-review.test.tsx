import type {
  Exercise,
  ExerciseListResponse,
  ExerciseNotice,
  OwnedExercise,
  UserRole,
} from "@athletept/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildExercise, buildPlan, buildUser, server } from "@/test/server";

const pistol: OwnedExercise = {
  ...buildExercise({
    id: "6acd3920c0072ec254663c11",
    name: "Pistol Squat",
    primaryMuscles: ["quads"],
    secondaryMuscles: [],
    scope: "private",
  }),
  owner: { id: "6acd3920c0072ec254663b01", name: "Anna" },
};

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
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items, total: items.length } satisfies ExerciseListResponse);
    }),
  );
  return requests;
}

describe("Übungen der Athleten (Coach)", () => {
  it("zeigt die Anzahl, listet mit Athletennamen und übernimmt in den eigenen Katalog", async () => {
    signIn("coach");
    mockList([]);
    let pending: OwnedExercise[] = [pistol];
    let adopted = false;
    server.use(
      http.get(apiUrl("/exercises/athlete-exercises"), () => HttpResponse.json({ items: pending })),
      http.post(apiUrl(`/exercises/${pistol.id}/adopt`), () => {
        adopted = true;
        pending = [];
        return HttpResponse.json({ ...pistol, scope: "own" });
      }),
    );
    renderApp("/coach/exercises");

    await userEvent.click(await screen.findByRole("radio", { name: "Von Athleten (1)" }));
    const list = await screen.findByRole("list", { name: "Zu prüfende Übungen" });
    expect(within(list).getByText("Pistol Squat")).toBeInTheDocument();
    expect(within(list).getByText(/von Anna/)).toBeInTheDocument();

    await userEvent.click(within(list).getByRole("button", { name: "Pistol Squat ansehen" }));
    const dialog = screen.getByRole("dialog", { name: "Pistol Squat" });
    expect(dialog).toHaveTextContent("Private Übung");
    await userEvent.keyboard("{Escape}");

    await userEvent.click(within(list).getByRole("button", { name: "Pistol Squat übernehmen" }));
    expect(
      await screen.findByText("„Pistol Squat“ ist jetzt in deinem Katalog."),
    ).toBeInTheDocument();
    expect(adopted).toBe(true);
    expect(await screen.findByText("Keine neuen Übungen")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Von Athleten" })).toBeInTheDocument();
  });

  it("zeigt den Konflikt verständlich, wenn der Name schon vergeben ist", async () => {
    signIn("coach");
    mockList([]);
    server.use(
      http.get(apiUrl("/exercises/athlete-exercises"), () =>
        HttpResponse.json({ items: [pistol] }),
      ),
      http.post(apiUrl(`/exercises/${pistol.id}/adopt`), () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Konflikt",
            status: 409,
            code: "exercise_name_taken",
            detail: "Du hast bereits eine Übung mit diesem Namen",
          },
          { status: 409 },
        ),
      ),
    );
    renderApp("/coach/exercises");

    await userEvent.click(await screen.findByRole("radio", { name: "Von Athleten (1)" }));
    await userEvent.click(await screen.findByRole("button", { name: "Pistol Squat übernehmen" }));

    expect(
      await screen.findByText("Du hast bereits eine Übung mit diesem Namen"),
    ).toBeInTheDocument();
  });

  it("schlägt eigene Übungen für den globalen Katalog vor und zieht zurück", async () => {
    signIn("coach");
    const own = buildExercise({ id: "6acd3920c0072ec254663c03", name: "Sled Push", scope: "own" });
    let current = own;
    mockList([own]);
    server.use(
      http.post(apiUrl(`/exercises/${own.id}/submit`), () => {
        current = { ...own, submitted: true };
        mockList([current]);
        return HttpResponse.json(current);
      }),
      http.post(apiUrl(`/exercises/${own.id}/withdraw`), () => {
        current = own;
        mockList([current]);
        return HttpResponse.json(current);
      }),
    );
    renderApp("/coach/exercises");

    await userEvent.click(
      await screen.findByRole("button", { name: "Sled Push für den globalen Katalog vorschlagen" }),
    );
    expect(await screen.findByText(/„Sled Push“ vorgeschlagen/)).toBeInTheDocument();
    expect(await screen.findByText("Vorgeschlagen")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Vorschlag für Sled Push zurückziehen" }),
    );
    expect(await screen.findByText("Vorschlag für „Sled Push“ zurückgezogen.")).toBeInTheDocument();
  });

  it("zeigt Hinweise zu übernommenen Übungen, bis sie weggeklickt werden", async () => {
    signIn("coach");
    mockList([]);
    let notices: ExerciseNotice[] = [
      {
        id: "6acd3920c0072ec254663d01",
        kind: "published",
        exerciseId: pistol.id,
        exerciseName: "Sled Push",
        createdAt: "2026-10-18T10:00:00.000Z",
      },
    ];
    server.use(
      http.get(apiUrl("/exercises/notices"), () => HttpResponse.json({ items: notices })),
      http.delete(apiUrl("/exercises/notices/:id"), () => {
        notices = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp("/coach/exercises");

    expect(
      await screen.findByText(/„Sled Push“ ist jetzt im globalen Übungskatalog/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hinweis schließen" }));
    await waitFor(() =>
      expect(screen.queryByText(/ist jetzt im globalen Übungskatalog/)).not.toBeInTheDocument(),
    );
  });
});

describe("Vorschläge (Sysadmin)", () => {
  it("übernimmt vorgeschlagene Coach-Übungen in den globalen Katalog", async () => {
    signIn("sysadmin");
    mockList([]);
    const submission: OwnedExercise = {
      ...pistol,
      scope: "own",
      submitted: true,
      owner: { id: "6acd3920c0072ec254663b02", name: "Clara" },
    };
    let published = false;
    server.use(
      http.get(apiUrl("/exercises/submissions"), () =>
        HttpResponse.json({ items: published ? [] : [submission] }),
      ),
      http.post(apiUrl(`/exercises/${pistol.id}/publish`), () => {
        published = true;
        return HttpResponse.json({ ...submission, scope: "global", submitted: false });
      }),
    );
    renderApp("/admin/exercises");

    await userEvent.click(await screen.findByRole("radio", { name: "Vorschläge (1)" }));
    expect(await screen.findByText(/von Coach Clara/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pistol Squat übernehmen" }));

    expect(
      await screen.findByText("„Pistol Squat“ ist jetzt im globalen Katalog."),
    ).toBeInTheDocument();
    expect(published).toBe(true);
  });
});

describe("Meine Übungen (Athlet)", () => {
  it("listet nur private Übungen und schlägt beim Anlegen vorhandene vor", async () => {
    signIn("athlete");
    const bank = buildExercise();
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(apiUrl("/exercises"), ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        const items = params.get("scope") === "private" ? [pistol] : [bank];
        return HttpResponse.json({ items, total: items.length } satisfies ExerciseListResponse);
      }),
      http.post(apiUrl("/exercises"), () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Konflikt",
            status: 409,
            code: "exercise_exists",
            detail: "„Bankdrücken“ gibt es schon. Verwende bitte diese Übung.",
            errors: [
              { path: "name", message: "„Bankdrücken“ gibt es schon. Verwende bitte diese Übung." },
            ],
          },
          { status: 409 },
        ),
      ),
    );
    renderApp("/exercises");

    expect(await screen.findByRole("heading", { name: "Meine Übungen" })).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Übungen" });
    expect(within(list).getByText("Pistol Squat")).toBeInTheDocument();
    expect(within(list).getByText("Privat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pistol Squat bearbeiten" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Eigene" })).not.toBeInTheDocument();
    expect(requests.every((params) => params.get("scope") === "private")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /Neue Übung/ }));
    const dialog = screen.getByRole("dialog", { name: "Neue Übung" });
    expect(dialog).toHaveTextContent("Private Übungen siehst nur du");
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "Bankdr");
    const similar = await within(dialog).findByRole("list", { name: "Ähnliche Übungen" });
    expect(within(similar).getByText("Bankdrücken")).toBeInTheDocument();
    // Auf der Übungsseite gibt es nichts zum Übernehmen, nur den Hinweis.
    expect(within(dialog).queryByRole("button", { name: /verwenden/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText(/^Kategorie/), "compound");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Equipment/), "barbell");
    const primary = within(dialog).getByRole("group", { name: /Primäre Muskelgruppen/ });
    await userEvent.click(within(primary).getByRole("checkbox", { name: "Brust" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    expect(
      await within(dialog).findByText("„Bankdrücken“ gibt es schon. Verwende bitte diese Übung."),
    ).toBeInTheDocument();
  });

  it("legt im eigenen Plan neue Übungen privat an oder übernimmt eine vorgeschlagene", async () => {
    signIn("athlete");
    const userId = useSession.getState().user!.id;
    const plan = buildPlan({ athleteId: userId, createdBy: "athlete" });
    const squat = buildExercise({
      id: "6acd3920c0072ec254663c02",
      name: "Kniebeuge",
      primaryMuscles: ["quads"],
      secondaryMuscles: [],
    });
    server.use(
      http.get(apiUrl(`/athletes/${userId}/plans/${plan.id}`), () => HttpResponse.json(plan)),
      http.get(apiUrl(`/athletes/${userId}/plans/${plan.id}/versions`), () =>
        HttpResponse.json({ items: [] }),
      ),
      http.get(apiUrl("/exercises"), () =>
        HttpResponse.json({ items: [squat], total: 1 } satisfies ExerciseListResponse),
      ),
    );
    const user = userEvent.setup();
    renderApp(`/plans/${plan.id}`);

    const picker = await screen.findByRole("combobox", {
      name: "Übung zu Oberkörper A hinzufügen",
    });
    await user.type(picker, "Kniebeuge tief");
    await user.click(await screen.findByRole("option", { name: /als neue Übung anlegen/ }));
    const dialog = screen.getByRole("dialog", { name: "Neue Übung" });
    expect(dialog).toHaveTextContent("Private Übungen siehst nur du");
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue("Kniebeuge tief");

    await user.click(await within(dialog).findByRole("button", { name: "Kniebeuge verwenden" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 3, name: /Kniebeuge/ })).toBeInTheDocument();
  });

  it("zeigt Hinweise auf der Trainingsseite und den Weg zu den eigenen Übungen", async () => {
    signIn("athlete");
    server.use(
      http.get(apiUrl("/me/permissions"), () =>
        HttpResponse.json({ ownPlan: true, ownWeek: false }),
      ),
      http.get(apiUrl("/me/plan"), () => HttpResponse.json({ plan: null })),
      http.get(apiUrl("/exercises/notices"), () =>
        HttpResponse.json({
          items: [
            {
              id: "6acd3920c0072ec254663d02",
              kind: "adopted",
              exerciseId: pistol.id,
              exerciseName: "Pistol Squat",
              createdAt: "2026-10-18T10:00:00.000Z",
            },
          ] satisfies ExerciseNotice[],
        }),
      ),
    );
    renderApp("/plan");

    expect(
      await screen.findByText(/Dein Coach hat „Pistol Squat“ in seinen Katalog übernommen/),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Meine Übungen/ })).toHaveAttribute(
      "href",
      "/exercises",
    );
  });
});
