import { PRIVACY_POLICY_VERSION, type InvitationInfo } from "@athletept/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, authResponse, buildUser, problem, server } from "@/test/server";

const TOKEN = "a".repeat(43);

const athleteInvitation: InvitationInfo = {
  name: "Max Muster",
  email: "max@example.com",
  role: "athlete",
  healthDataConsentRequired: true,
};

async function enterPasswords(password = "mein-neues-passwort", repeat = password) {
  await userEvent.type(
    await screen.findByLabelText(/^Neues Passwort/, { selector: "input" }),
    password,
  );
  await userEvent.type(
    screen.getByLabelText(/^Passwort wiederholen/, { selector: "input" }),
    repeat,
  );
}

describe("Einladung annehmen", () => {
  it("zeigt den Namen, holt die Einwilligung ein und meldet direkt an", async () => {
    useSession.setState({ status: "anonymous" });
    let acceptedBody: unknown;
    server.use(
      http.post(apiUrl("/auth/invitations/inspect"), () => HttpResponse.json(athleteInvitation)),
      http.post(apiUrl("/auth/invitations/accept"), async ({ request }) => {
        acceptedBody = await request.json();
        return HttpResponse.json(authResponse(buildUser({ name: "Max Muster" })));
      }),
    );
    const { router } = renderApp(`/invite#token=${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "Willkommen, Max!" })).toBeInTheDocument();
    expect(router.state.location.hash).toBe("");

    await enterPasswords();
    const consent = screen.getByRole("checkbox", { name: /Verarbeitung meiner Gesundheitsdaten/ });
    expect(consent).toHaveAccessibleDescription(/Art\. 9 Abs\. 2 lit\. a DSGVO/);
    expect(screen.getByRole("link", { name: /Datenschutzerklärung/ })).toHaveAttribute(
      "href",
      "/datenschutz",
    );
    await userEvent.click(consent);
    await userEvent.click(screen.getByRole("button", { name: "Konto aktivieren" }));

    expect(await screen.findByRole("heading", { name: "Hallo Max!" })).toBeInTheDocument();
    expect(acceptedBody).toEqual({
      token: TOKEN,
      password: "mein-neues-passwort",
      healthDataConsent: { accepted: true, privacyPolicyVersion: PRIVACY_POLICY_VERSION },
    });
  });

  it("nimmt die Einladung ohne Einwilligung nicht an", async () => {
    useSession.setState({ status: "anonymous" });
    let accepted = false;
    server.use(
      http.post(apiUrl("/auth/invitations/inspect"), () => HttpResponse.json(athleteInvitation)),
      http.post(apiUrl("/auth/invitations/accept"), () => {
        accepted = true;
        return HttpResponse.json(authResponse());
      }),
    );
    renderApp(`/invite#token=${TOKEN}`);

    await enterPasswords();
    await userEvent.click(screen.getByRole("button", { name: "Konto aktivieren" }));

    const consent = screen.getByRole("checkbox", { name: /Verarbeitung meiner Gesundheitsdaten/ });
    expect(consent).toBeInvalid();
    expect(consent).toHaveAccessibleDescription(/Ohne deine Einwilligung/);
    expect(accepted).toBe(false);
  });

  it("fragt Coaches nicht nach einer Einwilligung", async () => {
    useSession.setState({ status: "anonymous" });
    let acceptedBody: unknown;
    server.use(
      http.post(apiUrl("/auth/invitations/inspect"), () =>
        HttpResponse.json({
          name: "Clara Coach",
          email: "clara@example.com",
          role: "coach",
          healthDataConsentRequired: false,
        } satisfies InvitationInfo),
      ),
      http.post(apiUrl("/auth/invitations/accept"), async ({ request }) => {
        acceptedBody = await request.json();
        return HttpResponse.json(authResponse(buildUser({ role: "coach", name: "Clara" })));
      }),
      http.get(apiUrl("/athletes"), () =>
        HttpResponse.json({ items: [], quota: { used: 0, limit: 5 } }),
      ),
    );
    renderApp(`/invite#token=${TOKEN}`);

    await enterPasswords();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Konto aktivieren" }));

    await vi.waitFor(() =>
      expect(acceptedBody).toEqual({ token: TOKEN, password: "mein-neues-passwort" }),
    );
  });

  it("erklärt abgelaufene Einladungen", async () => {
    useSession.setState({ status: "anonymous" });
    server.use(
      http.post(apiUrl("/auth/invitations/inspect"), () =>
        problem(400, "invalid_token", "Der Link ist ungültig oder abgelaufen."),
      ),
    );
    renderApp(`/invite#token=${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "Einladung ungültig" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Der Link ist ungültig oder abgelaufen.");
  });

  it("prüft, ob beide Passwörter übereinstimmen", async () => {
    useSession.setState({ status: "anonymous" });
    server.use(
      http.post(apiUrl("/auth/invitations/inspect"), () => HttpResponse.json(athleteInvitation)),
    );
    renderApp(`/invite#token=${TOKEN}`);

    await enterPasswords("mein-neues-passwort", "etwas-anderes-123");
    await userEvent.click(screen.getByRole("button", { name: "Konto aktivieren" }));

    expect(await screen.findByText("Die Passwörter stimmen nicht überein")).toBeInTheDocument();
  });
});

describe("Passwort vergessen", () => {
  it("bestätigt die Anfrage, ohne zu verraten, ob es das Konto gibt", async () => {
    useSession.setState({ status: "anonymous" });
    server.use(
      http.post(
        apiUrl("/auth/password-reset/request"),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderApp("/forgot-password");

    await userEvent.type(await screen.findByLabelText(/E-Mail/), "max@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Link anfordern" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Falls ein Konto mit max@example.com existiert",
    );
  });

  it("führt nach dem Zurücksetzen zum Login mit Hinweis", async () => {
    useSession.setState({ status: "anonymous" });
    server.use(
      http.post(
        apiUrl("/auth/password-reset/confirm"),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderApp(`/reset-password#token=${TOKEN}`);

    await userEvent.type(
      await screen.findByLabelText(/^Neues Passwort/, { selector: "input" }),
      "mein-neues-passwort",
    );
    await userEvent.type(
      screen.getByLabelText(/^Passwort wiederholen/, { selector: "input" }),
      "mein-neues-passwort",
    );
    await userEvent.click(screen.getByRole("button", { name: "Passwort speichern" }));

    expect(await screen.findByRole("heading", { name: "Anmelden" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Dein Passwort wurde geändert");
  });
});

describe("Datenschutzerklärung", () => {
  it("ist ohne Anmeldung erreichbar und klar als Platzhalter markiert", async () => {
    useSession.setState({ status: "anonymous" });
    renderApp("/datenschutz");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Datenschutzerklärung" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Platzhalter: rechtlich prüfen lassen");
    expect(screen.getByText(new RegExp(`Version ${PRIVACY_POLICY_VERSION}`))).toBeInTheDocument();
  });
});
