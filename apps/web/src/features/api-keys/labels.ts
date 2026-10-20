import type { ApiKeyScope, UserRole, WriteSource } from "@athletept/shared";

export const scopeLabels: Record<ApiKeyScope, string> = {
  "exercises:read": "Übungen lesen",
  "exercises:write": "Übungen anlegen und bearbeiten",
  "plans:read": "Pläne lesen",
  "plans:write": "Pläne anlegen und bearbeiten",
  "workouts:read": "Trainings lesen",
  "workouts:write": "Trainings protokollieren",
  "stats:read": "Fortschritt lesen",
  "athletes:read": "Athletenliste lesen",
};

const group = (label: string, scopes: ApiKeyScope[]) => ({
  label,
  options: scopes.map((value) => ({ value, label: scopeLabels[value] })),
});

/** Gruppen für die Auswahl. `athletes:read` gibt es nur für Coaches. */
export function scopeGroups(role: UserRole | null, only?: readonly ApiKeyScope[]) {
  const groups = [
    group("Übungen", ["exercises:read", "exercises:write"]),
    group("Pläne und Vorlagen", ["plans:read", "plans:write"]),
    group("Trainings", ["workouts:read", "workouts:write"]),
    group("Fortschritt", ["stats:read"]),
    ...(role === "athlete" ? [] : [group("Athleten (nur Coaches)", ["athletes:read"])]),
  ];
  if (!only) return groups;
  return groups
    .map((g) => ({ ...g, options: g.options.filter((o) => only.includes(o.value)) }))
    .filter((g) => g.options.length > 0);
}

/** „über „App““ für Zeilen mit Metadaten, `null` bei Änderungen aus der Web-App. */
export function viaAppText(source: WriteSource) {
  return source ? `über „${source.appName}“` : null;
}
