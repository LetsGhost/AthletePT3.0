import type { UserRole } from "@athletept/shared";
import { useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
type Theme = "light" | "dark";

const STORAGE_KEY = "atp-theme";
const listeners = new Set<() => void>();
/** Fallback, falls localStorage nicht beschreibbar ist. */
let memoryPreference: ThemePreference | null = null;

function readPreference(): ThemePreference | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "system" || value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Speicher nicht verfügbar (z. B. privater Modus): gilt dann nur für diese Sitzung.
  }
  memoryPreference = preference;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

/** Ohne eigene Wahl: Athleten dunkel (wie die bisherige App), Coaches und Admins hell. */
function defaultPreference(role: UserRole | undefined): ThemePreference {
  if (role === "athlete") return "dark";
  if (role) return "light";
  return "system";
}

export function useThemePreference(role: UserRole | undefined): ThemePreference {
  const stored = useSyncExternalStore(subscribe, () => memoryPreference ?? readPreference());
  return stored ?? defaultPreference(role);
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Setzt `data-theme` am <html> und die Browser-Leistenfarbe. */
export function useApplyTheme(role: UserRole | undefined) {
  const preference = useThemePreference(role);
  const systemDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const theme = resolveTheme(preference);
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#101010" : "#f4f2f2");
  }, [preference, systemDark]);
}
