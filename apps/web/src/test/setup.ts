import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { useSession } from "@/features/auth/session";
import { useWhatsNewDialog } from "@/features/whats-new/store";

import { server } from "./server";

// Der „Was ist neu“-Dialog würde sich sonst in jedem Test über die Seite legen.
// Eigene Tests: whats-new.test.tsx (mit Testdaten).
vi.mock("@/features/whats-new/release-notes", () => ({ releaseNotes: [] }));

// jsdom kennt matchMedia nicht.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom zeichnet kein Canvas; Diagramme rendern in Tests nur das Canvas-Element.
HTMLCanvasElement.prototype.getContext = () => null;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  useSession.setState({ status: "loading", user: null, accessToken: null });
  useWhatsNewDialog.setState({ open: false });
});
afterAll(() => server.close());
