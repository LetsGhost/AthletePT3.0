import type { AthletePermissions, UserRole } from "@athletept/shared";
import { useSyncExternalStore } from "react";
import { create } from "zustand";

import { useMyPermissions } from "@/features/athletes/api";
import { useSession } from "@/features/auth/session";

import { releaseNotes } from "./release-notes";
import type { WhatsNewRelease } from "./types";

/**
 * Neuestes Release mit Neuerungen für diese Rolle (Einträge schon nach Rolle und Berechtigungen
 * gefiltert). Ohne `permissions` (andere Rolle, nicht geladen) fehlen Einträge mit Berechtigung.
 */
export function releaseFor(
  role: UserRole,
  releases: WhatsNewRelease[],
  permissions: AthletePermissions | null = null,
): WhatsNewRelease | null {
  for (const release of releases) {
    if (release.roles && !release.roles.includes(role)) continue;
    const items = release.items.filter(
      (item) =>
        (!item.roles || item.roles.includes(role)) &&
        (!item.permissions || item.permissions.every((key) => permissions?.[key] === true)),
    );
    if (items.length > 0) return { ...release, items };
  }
  return null;
}

/**
 * Je Gerät, nicht je Konto: Einmal geschlossen bleibt der Dialog zu, auch nach Konto-Wechsel.
 * Gespeichert wird `{ release, dismissed }`. Kommt ein Release mit neuer ID, gilt das Flag nicht mehr.
 */
const STORAGE_KEY = "atp-whats-new";
/** Alter Schlüssel (je Nutzer), wird noch gelesen, damit niemand den Dialog erneut sieht. */
const LEGACY_PREFIX = "atp-whats-new:";

interface DismissedState {
  release: string;
  dismissed: boolean;
}

const listeners = new Set<() => void>();
/** Fallback, falls localStorage nicht beschreibbar ist (gilt dann nur für diese Sitzung). */
let memory: DismissedState | null = null;

function readState(): DismissedState | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DismissedState>;
    return typeof parsed.release === "string" && parsed.dismissed === true
      ? { release: parsed.release, dismissed: true }
      : null;
  } catch {
    return null;
  }
}

function legacyDismissed(releaseId: string): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_PREFIX) && localStorage.getItem(key) === releaseId) return true;
    }
  } catch {
    // Kein Zugriff: dann eben nicht.
  }
  return false;
}

/** Merkt sich, dass dieses Release weggeklickt wurde. Der Dialog öffnet erst beim nächsten Release wieder. */
export function dismissRelease(releaseId: string) {
  const state: DismissedState = { release: releaseId, dismissed: true };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    memory = null;
  } catch {
    // Privater Modus o. Ä.: gilt dann nur für diese Sitzung.
    memory = state;
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Schließen in einem anderen Tab schließt auch hier.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Ob dieses Release schon weggeklickt wurde. */
export function useReleaseDismissed(releaseId: string | undefined): boolean {
  return useSyncExternalStore(subscribe, () => {
    if (!releaseId) return false;
    const state = readState();
    return state?.release === releaseId || legacyDismissed(releaseId);
  });
}

/** Manuelles Öffnen, z. B. über das Kontomenü. */
export const useWhatsNewDialog = create<{ open: boolean }>(() => ({ open: false }));

export function openWhatsNew() {
  useWhatsNewDialog.setState({ open: true });
}

/**
 * Release für den angemeldeten Nutzer. Bei Athleten erst, wenn ihre Berechtigungen geladen sind
 * (`ready`), sonst öffnete sich kurz ein älteres Release ohne die Einträge mit Berechtigung.
 * Schlägt das Laden fehl, gelten keine Berechtigungen.
 */
export function useWhatsNewRelease(releases: WhatsNewRelease[] = releaseNotes) {
  const role = useSession((state) => state.user?.role);
  const isAthlete = role === "athlete";
  const permissions = useMyPermissions({ enabled: isAthlete });
  const ready = !isAthlete || !permissions.isPending;
  const release =
    role && ready
      ? releaseFor(role, releases, isAthlete ? (permissions.data ?? null) : null)
      : null;
  return { release, ready };
}

/** Ob es für den Nutzer überhaupt Neuigkeiten gibt (für den Menüeintrag). */
export function useHasWhatsNew(releases: WhatsNewRelease[] = releaseNotes): boolean {
  return useWhatsNewRelease(releases).release !== null;
}
