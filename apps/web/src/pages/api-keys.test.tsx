import type { AdminApiKey, ApiKey, UserRole } from "@athletept/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, buildUser, buildWorkoutSummary, server } from "@/test/server";

const key = (overrides: Partial<ApiKey> = {}): ApiKey => ({
  id: "6acd3920c0072ec254663e01",
  name: "Trainings-Tracker",
  scopes: ["plans:read", "workouts:write"],
  status: "active",
  keyPreview: "apt_Xy3k",
  createdAt: "2026-10-01T00:00:00.000Z",
  activatedAt: "2026-10-02T00:00:00.000Z",
  expiresAt: "2027-10-02T00:00:00.000Z",
  lastUsedAt: null,
  pickupExpiresAt: null,
  ...overrides,
});

const adminKey = (overrides: Partial<AdminApiKey> = {}): AdminApiKey => ({
  ...key(),
  user: {
    id: "6acd3920c0072ec254663bd8",
    name: "Alex Athlet",
    email: "alex@example.com",
    role: "athlete",
  },
  rateLimit: 300,
  requestCount: 12,
  revokedAt: null,
  renewedFromId: null,
  ...overrides,
});

function signInAs(role: UserRole) {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role }),
    accessToken: "token",
  });
}

describe("API-Zugänge (Sysadmin)", () => {
  it("legt einen Zugang an, ohne den Schlüssel zu sehen", async () => {
    let body: unknown;
    server.use(
      http.get(apiUrl("/api-keys"), () => HttpResponse.json([])),
      http.post(apiUrl("/api-keys"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { ...adminKey({ status: "pending", keyPreview: null }), mailSent: true },
          { status: 201 },
        );
      }),
    );
    signInAs("sysadmin");
    renderApp("/admin/api-keys");

    await userEvent.click(await screen.findByRole("button", { name: "Zugang anlegen" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/E-Mail des Coaches/), "alex@example.com");
    await userEvent.type(within(dialog).getByLabelText(/Name der App/), "Trainings-Tracker");
    await userEvent.click(within(dialog).getByRole("button", { name: /Anlegen/ }));
    expect(await within(dialog).findByText("Bitte mindestens einen Bereich wählen")).toBeVisible();

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Pläne lesen" }));
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Trainings protokollieren" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: /Anlegen/ }));

    expect(await screen.findByText("Abhol-Link an alex@example.com verschickt.")).toBeVisible();
    expect(body).toEqual({
      email: "alex@example.com",
      name: "Trainings-Tracker",
      scopes: ["plans:read", "workouts:write"],
      rateLimit: 300,
    });
  });

  it("lässt beim Bearbeiten nur bisherige Bereiche zur Auswahl", async () => {
    let body: unknown;
    const apiKey = adminKey();
    server.use(
      http.get(apiUrl("/api-keys"), () => HttpResponse.json([apiKey])),
      http.patch(apiUrl(`/api-keys/${apiKey.id}`), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(apiKey);
      }),
    );
    signInAs("sysadmin");
    renderApp("/admin/api-keys");

    expect(await screen.findByText("12 Anfragen · Limit 300 je 15 Min.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
    const dialog = screen.getByRole("dialog");
    const chips = within(dialog).getAllByRole("checkbox");
    expect(chips.map((chip) => chip.closest("label")?.textContent)).toEqual([
      "Pläne lesen",
      "Trainings protokollieren",
    ]);

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Pläne lesen" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Änderungen gespeichert.")).toBeVisible();
    expect(body).toEqual({ name: "Trainings-Tracker", scopes: ["workouts:write"], rateLimit: 300 });
  });
});

describe("API-Zugänge erneuern (Sysadmin)", () => {
  it("weist auf den baldigen Ablauf hin und erneuert", async () => {
    let renewed = false;
    const soon = adminKey({ expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString() });
    const successor = adminKey({
      id: "6acd3920c0072ec254663e02",
      status: "pending",
      keyPreview: null,
      renewedFromId: soon.id,
    });
    server.use(
      http.get(apiUrl("/api-keys"), () => HttpResponse.json(renewed ? [successor, soon] : [soon])),
      http.post(apiUrl(`/api-keys/${soon.id}/renew`), () => {
        renewed = true;
        return HttpResponse.json({ ...successor, mailSent: true }, { status: 201 });
      }),
    );
    signInAs("sysadmin");
    renderApp("/admin/api-keys");

    expect(await screen.findByText("Läuft bald ab")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Erneuern" }));

    expect(
      await screen.findByText(/Der alte Zugang gilt bis zu seinem Ablauf weiter/),
    ).toBeVisible();
    expect(await screen.findByText(/Der neue Zugang wartet auf Abholung/)).toBeVisible();
    expect(screen.getByText("Erneuerung eines früheren Zugangs.")).toBeVisible();
    expect(screen.queryByText("Läuft bald ab")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Erneuern" })).not.toBeInTheDocument();
  });
});

describe("Herkunft aus externen Apps", () => {
  it("zeigt im Verlauf, welche App ein Training geschrieben hat", async () => {
    server.use(
      http.get(apiUrl("/me/workout-logs"), () =>
        HttpResponse.json({
          items: [buildWorkoutSummary({ lastWriteVia: { appName: "Trainings-Tracker" } })],
          total: 1,
        }),
      ),
    );
    signInAs("athlete");
    renderApp("/workouts");

    expect(await screen.findByText(/über „Trainings-Tracker“/)).toBeVisible();
  });
});

describe("API-Zugang abholen", () => {
  it("merkt sich den Link samt Token über die Anmeldung hinweg", async () => {
    useSession.setState({ status: "anonymous", user: null, accessToken: null });
    const { router } = renderApp("/api-zugang#token=abc");

    expect(await screen.findByRole("button", { name: "Anmelden" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.state).toEqual({ from: "/api-zugang#token=abc" });
  });

  it("zeigt den Schlüssel erst nach der Bestätigung und nur einmal", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/api-keys/pickup/inspect"), () =>
        HttpResponse.json({
          name: "Trainings-Tracker",
          scopes: ["plans:read"],
          pickupExpiresAt: "2026-10-27T00:00:00.000Z",
        }),
      ),
      http.post(apiUrl("/api-keys/pickup"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ key: "apt_geheim123", apiKey: key() });
      }),
    );
    signInAs("athlete");
    renderApp("/api-zugang#token=abc");

    expect(await screen.findByText("App „Trainings-Tracker“")).toBeVisible();
    expect(screen.getByText("Pläne lesen")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Schlüssel anzeigen" }));
    expect(screen.getByText("Bitte bestätige den Datenzugriff.")).toBeVisible();
    expect(body).toBeUndefined();

    await userEvent.click(screen.getByRole("checkbox", { name: /mit diesen Rechten/ }));
    await userEvent.click(screen.getByRole("button", { name: "Schlüssel anzeigen" }));

    expect(await screen.findByText("apt_geheim123")).toBeVisible();
    expect(screen.getByText("Nur jetzt sichtbar")).toBeVisible();
    expect(body).toEqual({ token: "abc", acceptDataAccess: true });
  });

  it("erklärt, wenn der Link zu einem anderen Konto gehört", async () => {
    server.use(
      http.post(apiUrl("/api-keys/pickup/inspect"), () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Forbidden",
            status: 403,
            code: "api_key_pickup_wrong_user",
            detail: "Dieser Link gehört zu einem anderen Konto.",
          },
          { status: 403, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    signInAs("coach");
    renderApp("/api-zugang#token=abc");

    expect(await screen.findByText("Dieser Link gehört zu einem anderen Konto.")).toBeVisible();
  });
});

describe("Verbundene Apps (Einstellungen)", () => {
  it("listet eigene Zugänge und zieht sie zurück", async () => {
    let revoked = false;
    const apiKey = key({ lastUsedAt: "2026-10-15T00:00:00.000Z" });
    server.use(
      http.get(apiUrl("/me/api-keys"), () =>
        HttpResponse.json([revoked ? { ...apiKey, status: "revoked" } : apiKey]),
      ),
      http.post(apiUrl(`/me/api-keys/${apiKey.id}/revoke`), () => {
        revoked = true;
        return HttpResponse.json({ ...apiKey, status: "revoked" });
      }),
    );
    signInAs("athlete");
    renderApp("/settings");

    expect(await screen.findByText("Trainings-Tracker")).toBeVisible();
    expect(screen.getByText(/apt_Xy3k…/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Zugang zurückziehen" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Zurückziehen" }),
    );

    expect(await screen.findByText("Zugang „Trainings-Tracker“ zurückgezogen.")).toBeVisible();
    expect(await screen.findByText("Zurückgezogen")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Zugang zurückziehen" })).not.toBeInTheDocument();
  });

  it("zeigt Sysadmins keine verbundenen Apps", async () => {
    signInAs("sysadmin");
    renderApp("/settings");

    expect(await screen.findByRole("heading", { name: "Passwort ändern" })).toBeVisible();
    expect(screen.queryByText("Verbundene Apps")).not.toBeInTheDocument();
  });
});
