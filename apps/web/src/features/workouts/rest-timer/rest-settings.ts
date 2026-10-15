import { useSyncExternalStore } from "react";

export interface RestSettings {
  /** Pausen-Timer nach dem Abhaken eines Satzes starten. */
  enabled: boolean;
  /** Pause in Sekunden für Übungen ohne Vorgabe vom Coach. */
  defaultSeconds: number;
}

/** Auswahl in den Einstellungen. */
export const restDefaultOptions = [30, 45, 60, 90, 120, 150, 180, 240, 300] as const;

const DEFAULTS: RestSettings = { enabled: true, defaultSeconds: 90 };
const STORAGE_KEY = "atp-rest-timer";
const listeners = new Set<() => void>();
/** Fallback, falls localStorage nicht beschreibbar ist. */
let memory: RestSettings | null = null;
/** Gleiche Referenz für gleichen Inhalt, sonst rendert useSyncExternalStore endlos. */
let cache: { raw: string | null; value: RestSettings } | null = null;

function read(): RestSettings {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Speicher gesperrt: Standardwerte.
  }
  if (cache && cache.raw === raw) return cache.value;
  let value = DEFAULTS;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<RestSettings>) : {};
    value = {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS.enabled,
      defaultSeconds: restDefaultOptions.includes(
        parsed.defaultSeconds as (typeof restDefaultOptions)[number],
      )
        ? parsed.defaultSeconds!
        : DEFAULTS.defaultSeconds,
    };
  } catch {
    // Kaputter Eintrag: Standardwerte.
  }
  cache = { raw, value };
  return value;
}

/** Gilt nur für dieses Gerät, wie das Farbschema. */
export function setRestSettings(change: Partial<RestSettings>) {
  const next = { ...read(), ...change };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    memory = null;
  } catch {
    // Privater Modus o. Ä.: gilt dann nur für diese Sitzung.
    memory = next;
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRestSettings(): RestSettings {
  return useSyncExternalStore(subscribe, read);
}
