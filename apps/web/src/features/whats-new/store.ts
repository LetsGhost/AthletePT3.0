import type { UserRole } from "@athletept/shared";
import { useSyncExternalStore } from "react";
import { create } from "zustand";

import { useSession } from "@/features/auth/session";

import { releaseNotes } from "./release-notes";
import type { WhatsNewRelease } from "./types";

/** Neuestes Release mit Neuerungen für diese Rolle (Einträge schon nach Rolle gefiltert). */
export function releaseFor(role: UserRole, releases: WhatsNewRelease[]): WhatsNewRelease | null {
  for (const release of releases) {
    if (release.roles && !release.roles.includes(role)) continue;
    const items = release.items.filter((item) => !item.roles || item.roles.includes(role));
    if (items.length > 0) return { ...release, items };
  }
  return null;
}

/** Je Nutzer, damit sich mehrere Konten auf einem Gerät nicht gegenseitig beeinflussen. */
const storageKey = (userId: string) => `atp-whats-new:${userId}`;
const listeners = new Set<() => void>();
/** Fallback, falls localStorage nicht beschreibbar ist (gilt dann nur für diese Sitzung). */
const memory = new Map<string, string>();

function readSeen(userId: string): string | null {
  const remembered = memory.get(userId);
  if (remembered) return remembered;
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/** Merkt sich, dass der Nutzer dieses Release gesehen hat. Der Dialog öffnet dann nicht mehr von selbst. */
export function markReleaseSeen(userId: string, releaseId: string) {
  try {
    localStorage.setItem(storageKey(userId), releaseId);
    memory.delete(userId);
  } catch {
    // Privater Modus o. Ä.: gilt dann nur für diese Sitzung.
    memory.set(userId, releaseId);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ID des zuletzt gesehenen Releases, `null` wenn noch keins. */
export function useSeenRelease(userId: string | undefined): string | null {
  return useSyncExternalStore(subscribe, () => (userId ? readSeen(userId) : null));
}

/** Manuelles Öffnen, z. B. über das Kontomenü. */
export const useWhatsNewDialog = create<{ open: boolean }>(() => ({ open: false }));

export function openWhatsNew() {
  useWhatsNewDialog.setState({ open: true });
}

/** Ob es für die Rolle überhaupt Neuigkeiten gibt (für den Menüeintrag). */
export function useHasWhatsNew(releases: WhatsNewRelease[] = releaseNotes): boolean {
  const role = useSession((state) => state.user?.role);
  return role ? releaseFor(role, releases) !== null : false;
}
