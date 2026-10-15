import type {
  MyPlanResponse,
  SkipWorkoutRequest,
  StartWorkoutRequest,
  UpdateWorkoutRequest,
  WeekView,
  WorkoutLog,
} from "@athletept/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import {
  apiUrl,
  buildPlan,
  buildUser,
  buildWeekView,
  buildWorkoutLog,
  buildWorkoutSummary,
  problem,
  server,
} from "@/test/server";

function signInAsAthlete() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "athlete", name: "Max Muster" }),
    accessToken: "token",
  });
}

const plan = buildPlan({ status: "active" });
const [day] = plan.days;

/** Woche mit „Oberkörper A“ (Montag) und einem flexiblen Tag. */
function weekWithPlan(overrides: Partial<WeekView> = {}): WeekView {
  return buildWeekView({
    plan: { id: plan.id, name: plan.name },
    days: [
      {
        dayId: day!.id,
        name: day!.name,
        type: day!.type,
        weekday: 1,
        status: "completed",
        logs: [buildWorkoutSummary()],
      },
      {
        dayId: "6acd3920c0072ec254663d12",
        name: "Arme",
        type: "UPPER",
        weekday: null,
        status: "open",
        logs: [],
      },
    ],
    activities: [null, null, "Laufen 30 min", null, null, null, null],
    completedCount: 1,
    plannedCount: 2,
    ...overrides,
  });
}

function mockWeek(week: WeekView) {
  server.use(http.get(apiUrl("/me/week"), () => HttpResponse.json(week)));
}

function mockMyPlan(response: MyPlanResponse = { plan }) {
  server.use(http.get(apiUrl("/me/plan"), () => HttpResponse.json(response)));
}

/** Liefert das Training und nimmt Speicherungen an (Revision zählt hoch). */
function mockWorkout(initial: WorkoutLog) {
  let current = initial;
  const saves: UpdateWorkoutRequest[] = [];
  server.use(
    http.get(apiUrl(`/me/workout-logs/${initial.id}`), () => HttpResponse.json(current)),
    http.put(apiUrl(`/me/workout-logs/${initial.id}`), async ({ request }) => {
      const body = (await request.json()) as UpdateWorkoutRequest;
      saves.push(body);
      current = { ...current, revision: current.revision + 1 };
      return HttpResponse.json(current);
    }),
  );
  return saves;
}

describe("Wochenübersicht (Athlet)", () => {
  it("zeigt Plantage mit Status, Wochenplan und Fortschritt", async () => {
    signInAsAthlete();
    mockWeek(weekWithPlan());
    renderApp("/dashboard");

    const days = await screen.findByRole("list", { name: "Wochentage" });
    expect(screen.getByText("1 von 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /Erledigte Trainings/ })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    const weekdayItems = [...days.querySelectorAll(":scope > li")] as HTMLElement[];
    const monday = weekdayItems[0]!;
    expect(monday).toHaveTextContent("Mo., 12. Okt.");
    expect(within(monday).getByRole("link", { name: /Oberkörper A/ })).toHaveTextContent(
      "Erledigt",
    );
    const today = weekdayItems[1]!;
    expect(today).toHaveAttribute("aria-current", "date");
    expect(within(days).getByText("Laufen 30 min")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ohne festen Tag" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Arme/ })).toHaveAttribute(
      "href",
      "/plan/6acd3920c0072ec254663d12",
    );
  });

  it("weist auf ein laufendes Training hin", async () => {
    signInAsAthlete();
    mockWeek(weekWithPlan({ inProgress: buildWorkoutSummary({ status: "in_progress" }) }));
    renderApp("/dashboard");

    expect(await screen.findByText("Training läuft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fortsetzen" })).toHaveAttribute(
      "href",
      "/workouts/6acd3920c0072ec254663e01",
    );
  });

  it("blättert in die Vorwoche", async () => {
    signInAsAthlete();
    const requested: (string | null)[] = [];
    server.use(
      http.get(apiUrl("/me/week"), ({ request }) => {
        const week = new URL(request.url).searchParams.get("week");
        requested.push(week);
        return HttpResponse.json(
          week === "2026-W41"
            ? buildWeekView({ week: "2026-W41", startDate: "2026-10-05", endDate: "2026-10-11" })
            : weekWithPlan(),
        );
      }),
    );
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.click(await screen.findByRole("button", { name: "Vorherige Woche" }));

    expect(await screen.findByText(/KW 41/)).toBeInTheDocument();
    expect(requested).toEqual([null, "2026-W41"]);
    expect(screen.getByRole("button", { name: "Heute" })).toBeInTheDocument();
  });

  it("erklärt, dass es noch keinen Plan gibt", async () => {
    signInAsAthlete();
    mockWeek(buildWeekView());
    renderApp("/dashboard");

    expect(await screen.findByText("Noch kein Trainingsplan")).toBeInTheDocument();
  });
});

describe("Training starten und absagen", () => {
  it("startet ein Training und öffnet es", async () => {
    signInAsAthlete();
    mockMyPlan();
    mockWeek(weekWithPlan({ days: [{ ...weekWithPlan().days[0]!, status: "open", logs: [] }] }));
    const log = buildWorkoutLog();
    mockWorkout(log);
    let started: StartWorkoutRequest | null = null;
    server.use(
      http.post(apiUrl("/me/workout-logs"), async ({ request }) => {
        started = (await request.json()) as StartWorkoutRequest;
        return HttpResponse.json(log, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp(`/plan/${day!.id}`);

    await user.click(await screen.findByRole("button", { name: "Training starten" }));

    expect(started).toEqual({ dayId: day!.id });
    expect(
      await screen.findByRole("textbox", { name: "Bankdrücken, Aufwärmsatz: Gewicht in kg" }),
    ).toHaveValue("40");
  });

  it("schickt zum laufenden Training statt ein zweites zu starten", async () => {
    signInAsAthlete();
    mockMyPlan();
    mockWeek(
      weekWithPlan({
        inProgress: buildWorkoutSummary({
          status: "in_progress",
          dayId: "6acd3920c0072ec254663d12",
          dayName: "Arme",
        }),
      }),
    );
    renderApp(`/plan/${day!.id}`);

    expect(await screen.findByText("Arme läuft noch")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Training starten" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Training fortsetzen" })).toBeInTheDocument();
  });

  it("sagt ein Training mit Grund ab", async () => {
    signInAsAthlete();
    mockMyPlan();
    mockWeek(weekWithPlan({ days: [{ ...weekWithPlan().days[0]!, status: "open", logs: [] }] }));
    let skipped: SkipWorkoutRequest | null = null;
    server.use(
      http.post(apiUrl("/me/workout-logs/skip"), async ({ request }) => {
        skipped = (await request.json()) as SkipWorkoutRequest;
        return HttpResponse.json(buildWorkoutLog({ status: "skipped", exercises: [] }), {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderApp(`/plan/${day!.id}`);

    await user.click(await screen.findByRole("button", { name: "Absagen" }));
    const dialog = await screen.findByRole("dialog", { name: "Oberkörper A absagen?" });
    expect(within(dialog).getByLabelText(/Datum/)).toHaveValue("2026-10-13");
    await user.type(within(dialog).getByLabelText("Grund (optional)"), "Krank");
    await user.click(within(dialog).getByRole("button", { name: "Training absagen" }));

    await waitFor(() =>
      expect(skipped).toEqual({ dayId: day!.id, date: "2026-10-13", notes: "Krank" }),
    );
    expect(await screen.findByText("Oberkörper A abgesagt.")).toBeInTheDocument();
  });

  it("zeigt Fehler zum Datum beim Nachtragen am Feld", async () => {
    signInAsAthlete();
    mockMyPlan();
    mockWeek(weekWithPlan());
    server.use(
      http.post(apiUrl("/me/workout-logs"), () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Bad Request",
            status: 400,
            code: "validation_failed",
            detail: "Die Anfrage ist ungültig",
            errors: [{ path: "date", message: "Höchstens 14 Tage zurück" }],
          },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp(`/plan/${day!.id}`);

    await user.click(await screen.findByRole("button", { name: "Nachtragen" }));
    const dialog = await screen.findByRole("dialog", { name: "Training nachtragen" });
    await user.click(within(dialog).getByRole("button", { name: "Eintragen" }));

    expect(await within(dialog).findByText("Höchstens 14 Tage zurück")).toBeInTheDocument();
  });
});

describe("Training durchführen", () => {
  it("speichert Eingaben automatisch mit Revision", async () => {
    signInAsAthlete();
    const saves = mockWorkout(buildWorkoutLog());
    const user = userEvent.setup();
    renderApp("/workouts/6acd3920c0072ec254663e01");

    expect((await screen.findByText(/Letztes Mal/)).closest("p")).toHaveTextContent(
      "Letztes Mal (Di., 6. Okt.): 77,5 kg × 8",
    );
    const weight = screen.getByRole("textbox", { name: "Bankdrücken, Satz 1: Gewicht in kg" });
    await user.clear(weight);
    await user.type(weight, "82,5");
    await user.click(screen.getByRole("checkbox", { name: "Bankdrücken, Satz 1 erledigt" }));

    await waitFor(() => expect(saves).toHaveLength(1), { timeout: 4000 });
    expect(saves[0]!.revision).toBe(0);
    expect(saves[0]!.exercises[0]!.sets[1]).toEqual({
      weightKg: 82.5,
      reps: 8,
      durationSeconds: null,
      done: true,
    });
    expect(await screen.findByText("Alles gespeichert")).toBeInTheDocument();
    expect(localStorage.getItem("athletept.workout.6acd3920c0072ec254663e01")).toBeNull();
  });

  it("startet die Pause beim Abhaken und klappt zur nächsten Übung weiter", async () => {
    signInAsAthlete();
    const [bench] = buildWorkoutLog().exercises;
    const log = buildWorkoutLog({
      exercises: [
        { ...bench!, sets: bench!.sets.slice(0, 1) },
        { ...bench!, id: "6acd3920c0072ec254663e12", exerciseName: "Rudern", restSeconds: 90 },
      ],
    });
    mockWorkout(log);
    const user = userEvent.setup();
    renderApp(`/workouts/${log.id}`);

    const rowing = await screen.findByRole("button", { name: /^Rudern/ });
    expect(rowing).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("progressbar", { name: "Erledigte Sätze" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );

    await user.click(screen.getByRole("checkbox", { name: "Bankdrücken, Aufwärmsatz erledigt" }));

    expect(screen.getByRole("timer")).toHaveTextContent("2:00");
    expect(screen.getByText("Pause · Bankdrücken")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Erledigte Sätze" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByRole("button", { name: /^Bankdrücken/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(rowing).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "15 Sekunden mehr" }));
    expect(screen.getByRole("timer")).toHaveTextContent("2:15");
    await user.click(screen.getByRole("button", { name: "Pause überspringen" }));
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("nutzt die eigene Standardpause und lässt sich in den Einstellungen abschalten", async () => {
    signInAsAthlete();
    const [bench] = buildWorkoutLog().exercises;
    const log = buildWorkoutLog({ exercises: [{ ...bench!, restSeconds: null }] });
    mockWorkout(log);
    const user = userEvent.setup();
    const { unmount } = renderApp("/settings");

    expect(await screen.findByRole("heading", { name: "Training" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Standardpause"), "1:00 min");
    unmount();

    const workout = renderApp(`/workouts/${log.id}`);
    await user.click(
      await screen.findByRole("checkbox", { name: "Bankdrücken, Aufwärmsatz erledigt" }),
    );
    expect(screen.getByRole("timer")).toHaveTextContent("1:00");
    await user.click(screen.getByRole("button", { name: "Pause überspringen" }));
    workout.unmount();

    const settingsAgain = renderApp("/settings");
    await user.click(await screen.findByRole("checkbox", { name: "Pausen-Timer" }));
    expect(screen.getByLabelText("Standardpause")).toBeDisabled();
    settingsAgain.unmount();

    renderApp(`/workouts/${log.id}`);
    await user.click(await screen.findByRole("checkbox", { name: "Bankdrücken, Satz 1 erledigt" }));
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("klappt eine ausgelassene Übung zu und auf Wunsch wieder auf", async () => {
    signInAsAthlete();
    mockWorkout(buildWorkoutLog());
    const user = userEvent.setup();
    renderApp("/workouts/6acd3920c0072ec254663e01");

    await user.click(await screen.findByRole("button", { name: "Auslassen" }));

    expect(screen.getByText("Ausgelassen")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Erledigte Sätze" })).toHaveAttribute(
      "aria-valuemax",
      "0",
    );
    await user.click(screen.getByRole("button", { name: "Doch machen" }));
    expect(
      screen.getByRole("checkbox", { name: "Bankdrücken, Aufwärmsatz erledigt" }),
    ).toBeInTheDocument();
  });

  it("markiert ungültige Eingaben und speichert sie nicht", async () => {
    signInAsAthlete();
    const saves = mockWorkout(buildWorkoutLog());
    const user = userEvent.setup();
    renderApp("/workouts/6acd3920c0072ec254663e01");

    const reps = await screen.findByRole("textbox", {
      name: "Bankdrücken, Satz 1: Wiederholungen",
    });
    await user.clear(reps);
    await user.type(reps, "acht");

    expect(reps).toHaveAttribute("aria-invalid", "true");
    expect(await screen.findByText("Satz 1: Bitte eine Zahl")).toBeInTheDocument();
    expect(
      await screen.findByText("Bitte die markierten Felder korrigieren", undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument();
    expect(saves).toHaveLength(0);
  });

  it("sichert ohne Netz lokal und stellt den Stand beim nächsten Öffnen wieder her", async () => {
    signInAsAthlete();
    const log = buildWorkoutLog();
    server.use(
      http.get(apiUrl(`/me/workout-logs/${log.id}`), () => HttpResponse.json(log)),
      http.put(apiUrl(`/me/workout-logs/${log.id}`), () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    const { unmount } = renderApp(`/workouts/${log.id}`);

    await user.click(await screen.findByRole("checkbox", { name: "Bankdrücken, Satz 1 erledigt" }));
    expect(await screen.findByText(/Offline/, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(localStorage.getItem(`athletept.workout.${log.id}`)).toContain('"done":true');
    unmount();

    renderApp(`/workouts/${log.id}`);
    expect(
      await screen.findByRole("checkbox", { name: "Bankdrücken, Satz 1 erledigt" }),
    ).toBeChecked();
  });

  it("verwirft einen lokalen Stand, der auf einer älteren Revision aufbaut", async () => {
    signInAsAthlete();
    const log = buildWorkoutLog({ revision: 5 });
    mockWorkout(log);
    localStorage.setItem(
      `athletept.workout.${log.id}`,
      JSON.stringify({
        revision: 4,
        draft: { exercises: [], rating: 3, notes: "alt" },
      }),
    );
    renderApp(`/workouts/${log.id}`);

    expect(await screen.findByLabelText("Kommentar für deinen Coach")).toHaveValue("");
    expect(localStorage.getItem(`athletept.workout.${log.id}`)).toBeNull();
  });

  it("schließt ab und weist auf nicht abgehakte Sätze hin", async () => {
    signInAsAthlete();
    const log = buildWorkoutLog();
    mockWorkout(log);
    mockWeek(weekWithPlan());
    let completed: UpdateWorkoutRequest | null = null;
    server.use(
      http.post(apiUrl(`/me/workout-logs/${log.id}/complete`), async ({ request }) => {
        completed = (await request.json()) as UpdateWorkoutRequest;
        return HttpResponse.json({
          ...log,
          status: "completed",
          revision: 1,
          newRecords: [
            {
              exerciseId: log.exercises[0]!.exerciseId,
              exerciseName: "Bankdrücken",
              kind: "topWeightKg",
              value: 82.5,
              previous: 80,
            },
          ],
        });
      }),
    );
    const user = userEvent.setup();
    renderApp(`/workouts/${log.id}`);

    const rating = await screen.findByRole("group", { name: "Wie war das Training?" });
    await user.click(within(rating).getByRole("radio", { name: "8" }));
    await user.click(screen.getByRole("button", { name: "Training abschließen" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Training abschließen?" });
    expect(dialog).toHaveTextContent("4 Sätze sind nicht abgehakt");
    await user.click(within(dialog).getByRole("button", { name: "Abschließen" }));

    await waitFor(() => expect(completed).toMatchObject({ revision: 0, rating: 8 }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Training abgeschlossen" }),
    ).toHaveFocus();
    expect(screen.getByRole("region", { name: "Neuer Bestwert!" })).toHaveTextContent(
      "Bankdrücken: Höchstes Gewicht 82,5 kg (bisher 80 kg)",
    );
    await user.click(screen.getByRole("link", { name: "Zur Übersicht" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hallo Max!" }),
    ).toBeInTheDocument();
  });

  it("zeigt abgeschlossene Trainings nach Ablauf der Frist nur lesend", async () => {
    signInAsAthlete();
    const base = buildWorkoutLog();
    const log = buildWorkoutLog({
      status: "completed",
      editable: false,
      rating: 9,
      notes: "Top",
      completedAt: "2026-10-01T18:00:00.000Z",
      editableUntil: "2026-10-08T18:00:00.000Z",
      exercises: base.exercises.map((x) => ({
        ...x,
        sets: x.sets.map((s, i) => ({ ...s, done: i < 2 })),
      })),
    });
    mockWorkout(log);
    renderApp(`/workouts/${log.id}`);

    const table = await screen.findByRole("table", { name: "Sätze Bankdrücken" });
    const rows = within(table).getAllByRole("row");
    expect(rows[2]).toHaveTextContent("6–8 Wdh. · 80 kg");
    expect(rows[2]).toHaveTextContent("80 kg × 8");
    expect(rows[3]).toHaveTextContent("nicht gemacht");
    expect(screen.getByText("9 von 10")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("meldet ein unbekanntes Training", async () => {
    signInAsAthlete();
    server.use(http.get(apiUrl("/me/workout-logs/:id"), () => problem(404, "not_found")));
    renderApp("/workouts/6acd3920c0072ec254663fff");

    expect(await screen.findByText("Training nicht gefunden")).toBeInTheDocument();
  });
});
