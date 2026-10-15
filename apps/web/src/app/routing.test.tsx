import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useSession } from "@/features/auth/session";
import { renderApp } from "@/test/render";
import { apiUrl, authResponse, buildUser, problem, server } from "@/test/server";

describe("Login und Routing", () => {
  it("leitet nicht angemeldete Nutzer zum Login und nach dem Login zurück zum Ziel", async () => {
    useSession.setState({ status: "anonymous" });
    server.use(
      http.post(apiUrl("/auth/login"), () => HttpResponse.json(authResponse(buildUser()))),
    );
    const { router } = renderApp("/settings");

    expect(await screen.findByRole("heading", { name: "Anmelden" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/E-Mail/), "max@example.com");
    await userEvent.type(
      screen.getByLabelText(/^Passwort/, { selector: "input" }),
      "geheimes-passwort",
    );
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
  });

  it("kennzeichnet die geschlossene Beta auf dem Login und in der App", async () => {
    useSession.setState({ status: "anonymous" });
    const login = renderApp("/login");

    expect(await screen.findByText("Beta")).toBeInTheDocument();
    expect(screen.getByText(/geschlossenen Beta/)).toBeInTheDocument();
    login.unmount();

    useSession.setState({
      status: "authenticated",
      user: buildUser({ role: "coach" }),
      accessToken: "token",
    });
    renderApp("/settings");
    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    // Logo in Seitenleiste und mobiler Kopfzeile
    expect(screen.getAllByText("Beta").length).toBeGreaterThan(0);
  });

  it("zeigt die Fehlermeldung der API bei falschen Zugangsdaten", async () => {
    useSession.setState({ status: "anonymous" });
    server.use(
      http.post(apiUrl("/auth/login"), () =>
        problem(401, "invalid_credentials", "E-Mail oder Passwort ist falsch"),
      ),
    );
    renderApp("/login");

    await userEvent.type(await screen.findByLabelText(/E-Mail/), "max@example.com");
    await userEvent.type(screen.getByLabelText(/^Passwort/, { selector: "input" }), "falsch");
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-Mail oder Passwort ist falsch");
  });

  it("prüft das Formular vor dem Absenden", async () => {
    useSession.setState({ status: "anonymous" });
    renderApp("/login");

    await userEvent.click(await screen.findByRole("button", { name: "Anmelden" }));

    expect(await screen.findByText("Ungültige E-Mail-Adresse")).toBeInTheDocument();
    expect(screen.getByLabelText(/E-Mail/)).toHaveAttribute("aria-invalid", "true");
  });

  it("schickt Nutzer von fremden Bereichen auf ihre eigene Startseite", async () => {
    useSession.setState({
      status: "authenticated",
      user: buildUser({ role: "athlete", name: "Max Muster" }),
      accessToken: "token",
    });
    const { router } = renderApp("/coach");

    expect(await screen.findByRole("heading", { name: "Hallo Max!" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });

  it("zeigt für unbekannte Seiten eine 404-Seite", async () => {
    useSession.setState({ status: "authenticated", user: buildUser(), accessToken: "token" });
    renderApp("/gibt-es-nicht");

    expect(await screen.findByText("Diese Seite gibt es nicht")).toBeInTheDocument();
  });
});
