import type { AcceptInvitationRequest, AuthResponse, LoginRequest, User } from "@athletept/shared";
import { create } from "zustand";

import { ApiError, rawRequest } from "@/lib/http";

type SessionStatus = "loading" | "authenticated" | "anonymous";

interface SessionState {
  status: SessionStatus;
  user: User | null;
  /** Nur im Speicher, nie in localStorage (Schutz vor XSS-Diebstahl). */
  accessToken: string | null;
}

export const useSession = create<SessionState>(() => ({
  status: "loading",
  user: null,
  accessToken: null,
}));

function applySession(response: AuthResponse) {
  useSession.setState({
    status: "authenticated",
    user: response.user,
    accessToken: response.accessToken,
  });
}

function clearSession() {
  useSession.setState({ status: "anonymous", user: null, accessToken: null });
}

// Andere Tabs über Logout informieren.
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("atp-auth");
channel?.addEventListener("message", (event: MessageEvent<string>) => {
  if (event.data === "logout") clearSession();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestRefresh(): Promise<AuthResponse | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await rawRequest<AuthResponse>("/auth/refresh", { method: "POST" });
    } catch (error) {
      // Ein anderer Tab hat gerade rotiert. Das neue Cookie ist schon gesetzt, also erneut versuchen.
      if (error instanceof ApiError && error.code === "refresh_conflict") {
        await sleep(200 * (attempt + 1));
        continue;
      }
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return null;
      }
      throw error;
    }
  }
  return null;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Erneuert die Sitzung über das Refresh-Cookie. Parallele Aufrufe im selben Tab teilen sich
 * einen Request. Über Tabs hinweg serialisiert ein Web Lock die Refreshes, damit die
 * Token-Rotation nicht kollidiert.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const run = () => requestRefresh();
      const response =
        typeof navigator !== "undefined" && "locks" in navigator
          ? await navigator.locks.request("atp-refresh", run)
          : await run();
      if (response) {
        applySession(response);
        return true;
      }
      clearSession();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Beim App-Start: bestehende Sitzung aus dem Cookie wiederherstellen. */
export async function initSession() {
  try {
    await refreshSession();
  } catch {
    // Server nicht erreichbar: als abgemeldet behandeln, Login-Seite zeigt dann den Fehler.
    clearSession();
  }
}

export async function login(credentials: LoginRequest) {
  const response = await rawRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: credentials,
  });
  applySession(response);
  return response.user;
}

/** Trainingsentwürfe und Pausen-Timer (Gesundheitsdaten) nicht auf geteilten Geräten liegen lassen. */
function clearWorkoutStorage() {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const key of keys) {
      if (key?.startsWith("athletept.workout.") || key?.startsWith("athletept.rest.")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage gesperrt: dann liegt dort auch nichts.
  }
}

export async function logout() {
  try {
    await rawRequest("/auth/logout", { method: "POST" });
  } finally {
    clearWorkoutStorage();
    clearSession();
    channel?.postMessage("logout");
  }
}

/** Wird vom API-Client aufgerufen, wenn die Sitzung endgültig ungültig ist. */
export function sessionExpired() {
  clearSession();
}

export function updateSessionUser(user: User) {
  useSession.setState({ user });
}

/** Einladung annehmen: Passwort setzen und direkt angemeldet sein. */
export async function acceptInvitation(body: AcceptInvitationRequest) {
  const response = await rawRequest<AuthResponse>("/auth/invitations/accept", {
    method: "POST",
    body,
  });
  applySession(response);
  return response.user;
}
