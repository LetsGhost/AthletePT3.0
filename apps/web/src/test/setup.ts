import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { useSession } from "@/features/auth/session";

import { server } from "./server";

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
});
afterAll(() => server.close());
