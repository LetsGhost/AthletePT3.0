import type {
  AthleteDetail,
  CreatePlanRequest,
  ExerciseListResponse,
  Plan,
  PlanTemplate,
  PlanTemplateListResponse,
  UpdatePlanRequest,
} from "@athletept/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import {
  apiUrl,
  buildExercise,
  buildPlan,
  buildPlanExerciseInfo,
  buildUser,
  problem,
  server,
} from "@/test/server";

const athleteId = "6acd3920c0072ec254663bd9";
const planPath = (plan: Plan) => `/coach/athletes/${athleteId}/plans/${plan.id}`;

const athlete: AthleteDetail = {
  id: athleteId,
  name: "Max Muster",
  email: "max@example.com",
  status: "active",
  goal: null,
  focus: null,
  lastLoginAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  profile: {},
  permissions: { ownPlan: false, ownWeek: false },
} as unknown as AthleteDetail;

function signInAsCoach() {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "coach", name: "Clara Coach" }),
    accessToken: "token",
  });
}

/** Athlet und Plan. PUT antwortet mit dem gespeicherten Stand und merkt sich die Anfrage. */
function mockPlan(plan: Plan) {
  const saved: UpdatePlanRequest[] = [];
  server.use(
    http.get(apiUrl(`/athletes/${athleteId}`), () => HttpResponse.json(athlete)),
    http.get(apiUrl(`/athletes/${athleteId}/plans/${plan.id}`), () => HttpResponse.json(plan)),
    http.get(apiUrl(`/athletes/${athleteId}/plans/${plan.id}/versions`), () =>
      HttpResponse.json({ items: [] }),
    ),
    http.put(apiUrl(`/athletes/${athleteId}/plans/${plan.id}`), async ({ request }) => {
      const body = (await request.json()) as UpdatePlanRequest;
      saved.push(body);
      return HttpResponse.json({ ...plan, name: body.name, revision: plan.revision + 1 });
    }),
  );
  return saved;
}

const squat = buildExercise({
  id: "6acd3920c0072ec254663c02",
  name: "Kniebeuge",
  primaryMuscles: ["quads", "glutes"],
  secondaryMuscles: [],
});

function mockCatalog() {
  server.use(
    http.get(apiUrl("/exercises"), () =>
      HttpResponse.json({ items: [squat], total: 1 } satisfies ExerciseListResponse),
    ),
  );
}

describe("Plan-Editor (Coach)", () => {
  it("fügt eine Übung per Auswahl und Schnelleingabe hinzu und speichert den ganzen Plan", async () => {
    signInAsCoach();
    const plan = buildPlan();
    const saved = mockPlan(plan);
    mockCatalog();
    const user = userEvent.setup();
    renderApp(planPath(plan));

    expect(await screen.findByRole("heading", { level: 1, name: "Block 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speichern" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Übung zu Oberkörper A hinzufügen" }));
    await user.click(await screen.findByRole("option", { name: /Kniebeuge/ }));
    const entry = screen.getByRole("heading", { level: 3, name: /Kniebeuge/ }).closest("article")!;
    // Der Schwerpunkt passt sich live an: Bankdrücken + Kniebeuge ist Ganzkörper (je 50 %).
    expect(within(screen.getByRole("tabpanel")).getByText("Ganzkörper")).toBeInTheDocument();

    const shorthand = within(entry as HTMLElement).getByLabelText("Schnelleingabe Arbeitssätze");
    await user.type(shorthand, "3x8-10@60 RIR2{Enter}");
    expect(within(entry as HTMLElement).getAllByLabelText(/Wiederholungen von/)).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    const body = saved[0]!;
    expect(body.revision).toBe(3);
    const day = body.days![0]!;
    expect(day.id).toBe(plan.days[0]!.id);
    expect(day.exercises![0]!.id).toBe(plan.days[0]!.exercises[0]!.id);
    expect(day.exercises![1]).toMatchObject({ exerciseId: squat.id, restSeconds: null });
    expect(day.exercises![1]!.sets).toEqual(
      Array.from({ length: 3 }, () => ({
        kind: "working",
        repsMin: 8,
        repsMax: 10,
        durationSeconds: null,
        weightKg: 60,
        rir: 2,
      })),
    );
    expect(await screen.findByText("Alles gespeichert")).toBeInTheDocument();
  });

  it("zeigt Feldfehler der API an der Übung und meldet Konflikte", async () => {
    signInAsCoach();
    const plan = buildPlan();
    mockPlan(plan);
    const user = userEvent.setup();
    let attempt = 0;
    server.use(
      http.put(apiUrl(`/athletes/${athleteId}/plans/${plan.id}`), () => {
        attempt += 1;
        if (attempt === 1) {
          return HttpResponse.json(
            {
              type: "about:blank",
              title: "Bad Request",
              status: 400,
              code: "validation_failed",
              detail: "Einige Übungen können nicht verwendet werden",
              errors: [
                {
                  path: "days.0.exercises.0.exerciseId",
                  message: "„Bankdrücken“ ist archiviert und kann nicht neu eingeplant werden",
                },
              ],
            },
            { status: 400, headers: { "Content-Type": "application/problem+json" } },
          );
        }
        return problem(409, "plan_conflict");
      }),
    );
    renderApp(planPath(plan));

    const name = await screen.findByRole("textbox", { name: "Name" });
    await user.type(name, " neu");
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect(
      await screen.findByText(/ist archiviert und kann nicht neu eingeplant werden/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Inzwischen geändert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neu laden" })).toBeInTheDocument();
  });

  it("prüft Sätze schon vor dem Speichern", async () => {
    signInAsCoach();
    const plan = buildPlan();
    const saved = mockPlan(plan);
    const user = userEvent.setup();
    renderApp(planPath(plan));

    const max = await screen.findByLabelText("Satz 2: Wiederholungen bis");
    await user.clear(max);
    await user.type(max, "4");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText("Satz 2: Darf nicht kleiner als das Minimum sein"),
    ).toBeInTheDocument();
    expect(saved).toHaveLength(0);
  });

  it("bearbeitet Tage als Tabs und springt beim Speichern zum Tag mit Fehlern", async () => {
    signInAsCoach();
    const plan = buildPlan();
    const saved = mockPlan(plan);
    const user = userEvent.setup();
    renderApp(planPath(plan));

    const firstTab = await screen.findByRole("tab", { name: /Oberkörper A/ });
    expect(firstTab).toHaveAttribute("aria-selected", "true");

    // Warm-up als Freitext mit Details, Wochentag abwählen (flexibel).
    await user.type(screen.getByRole("combobox", { name: /Warm-up-Übung/ }), "Seilspringen");
    await user.type(screen.getByLabelText(/Details zum Warm-up/), "2 min{Enter}");
    expect(screen.getByText("Seilspringen")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Montag", pressed: true }));
    // Geleerte Felder bleiben leer, auch nach einem Tab-Wechsel.
    await user.clear(screen.getByLabelText("Satz 1: Gewicht in kg"));

    // Tag duplizieren: Kopie wird aktiv, Namen leeren erzeugt einen Fehler.
    await user.click(screen.getByRole("button", { name: "Oberkörper A duplizieren" }));
    expect(screen.getByRole("tab", { name: /Oberkörper A \(Kopie\)/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.clear(screen.getByRole("textbox", { name: "Name des Tages" }));
    await user.click(firstTab);
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    const copyTab = await screen.findByRole("tab", { name: /enthält Fehler/ });
    expect(copyTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Bitte einen Namen angeben")).toBeInTheDocument();
    expect(saved).toHaveLength(0);

    await user.type(screen.getByRole("textbox", { name: "Name des Tages" }), "Oberkörper B");
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    const [first, copy] = saved[0]!.days!;
    expect(first).toMatchObject({ weekday: null });
    expect(first!.exercises![0]!.sets[1]).toMatchObject({ weightKg: null });
    expect(first!.warmup).toContainEqual(
      expect.objectContaining({ exerciseId: null, name: "Seilspringen", details: "2 min" }),
    );
    expect(copy).not.toHaveProperty("id");
    expect(copy!.name).toBe("Oberkörper B");
    expect(copy!.exercises![0]).not.toHaveProperty("id");
  });

  it("fragt nach, bevor ungespeicherte Änderungen verloren gehen", async () => {
    signInAsCoach();
    const plan = buildPlan();
    mockPlan(plan);
    const user = userEvent.setup();
    const { router } = renderApp(planPath(plan));

    await user.type(await screen.findByRole("textbox", { name: "Name" }), "!");
    await user.click(screen.getByRole("link", { name: "Max Muster" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "Ungespeicherte Änderungen verwerfen?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Weiter bearbeiten" }));
    expect(router.state.location.pathname).toBe(planPath(plan));
    expect(screen.getByRole("button", { name: "Aktivieren" })).toBeDisabled();
  });

  it("zeigt archivierte Pläne nur lesend", async () => {
    signInAsCoach();
    const plan = buildPlan({
      status: "archived",
      archivedAt: "2026-10-05T00:00:00.000Z",
      exercises: [buildPlanExerciseInfo({ executionNotes: "Schulterblätter zusammen" })],
    });
    mockPlan(plan);
    const user = userEvent.setup();
    renderApp(planPath(plan));

    expect(await screen.findByText(/Archivierte Pläne sind schreibgeschützt/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Speichern" })).not.toBeInTheDocument();
    expect(screen.getByText("3 × 6–8 Wdh. · 80 kg · RIR 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wieder aktivieren" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Anleitung zu Bankdrücken" }));
    expect(screen.getByRole("dialog", { name: "Bankdrücken" })).toHaveTextContent(
      "Schulterblätter zusammen",
    );
  });

  it("aktiviert einen Entwurf und zeigt fehlende Übungen als Fehler", async () => {
    signInAsCoach();
    const plan = buildPlan();
    mockPlan(plan);
    server.use(
      http.post(apiUrl(`/athletes/${athleteId}/plans/${plan.id}/activate`), () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Bad Request",
            status: 400,
            code: "plan_incomplete",
            detail: "Ein aktiver Plan braucht mindestens einen Trainingstag",
            errors: [
              { path: "days.1.exercises", message: "„Tag B“ braucht mindestens eine Übung" },
            ],
          },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp(planPath(plan));

    await user.click(await screen.findByRole("button", { name: "Aktivieren" }));
    const dialog = screen.getByRole("alertdialog", { name: "„Block 1“ aktivieren?" });
    await user.click(within(dialog).getByRole("button", { name: "Aktivieren" }));

    expect(await screen.findByText("„Tag B“ braucht mindestens eine Übung")).toBeInTheDocument();
  });
});

describe("Pläne auf der Athletenseite", () => {
  it("legt einen Plan aus einer Vorlage an (ohne IDs) und öffnet den Editor", async () => {
    signInAsCoach();
    const template: PlanTemplate = {
      ...buildPlan(),
      id: "6acd3920c0072ec254663e01",
      name: "Ganzkörper Einsteiger",
    };
    const created = buildPlan({ name: "Block für Max", id: "6acd3920c0072ec254663d02" });
    const requests: CreatePlanRequest[] = [];
    mockPlan(created);
    server.use(
      http.get(apiUrl("/plan-templates"), () =>
        HttpResponse.json({
          items: [
            {
              id: template.id,
              name: template.name,
              type: "UPPER",
              dayCount: 1,
              updatedAt: template.updatedAt,
            },
          ],
        } satisfies PlanTemplateListResponse),
      ),
      http.get(apiUrl(`/plan-templates/${template.id}`), () => HttpResponse.json(template)),
      http.post(apiUrl(`/athletes/${athleteId}/plans`), async ({ request }) => {
        requests.push((await request.json()) as CreatePlanRequest);
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp(`/coach/athletes/${athleteId}`);

    expect(await screen.findByText("Noch kein Trainingsplan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ersten Plan anlegen" }));
    const dialog = screen.getByRole("dialog", { name: "Neuer Plan" });
    await user.selectOptions(
      await within(dialog).findByLabelText("Vorlage"),
      await within(dialog).findByRole("option", { name: /Ganzkörper Einsteiger/ }),
    );
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue("Ganzkörper Einsteiger");
    await user.clear(within(dialog).getByLabelText(/^Name/));
    await user.type(within(dialog).getByLabelText(/^Name/), "Block für Max");
    await user.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(planPath(created)));
    const body = requests[0]!;
    expect(body.name).toBe("Block für Max");
    expect(body.days![0]).not.toHaveProperty("id");
    expect(body.days![0]!.exercises![0]).not.toHaveProperty("id");
    expect(body.days![0]!.exercises![0]!.exerciseId).toBe(template.exercises[0]!.id);
  });
});

describe("Vorlagen", () => {
  it("zeigt einen Leerzustand und legt eine Vorlage an", async () => {
    signInAsCoach();
    const template: PlanTemplate = { ...buildPlan({ days: [] }), name: "Push/Pull" };
    server.use(
      http.get(apiUrl("/plan-templates"), () => HttpResponse.json({ items: [] })),
      http.post(apiUrl("/plan-templates"), () => HttpResponse.json(template, { status: 201 })),
      http.get(apiUrl(`/plan-templates/${template.id}`), () => HttpResponse.json(template)),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/coach/templates");

    expect(await screen.findByText("Noch keine Vorlagen")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Neue Vorlage" })[0]!);
    await user.type(screen.getByLabelText(/Name der Vorlage/), "Push/Pull");
    await user.click(screen.getByRole("button", { name: "Anlegen" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/coach/templates/${template.id}`),
    );
    expect(
      await screen.findByText("Noch keine Trainingstage. Lege den ersten Tag an."),
    ).toBeInTheDocument();
  });
});
