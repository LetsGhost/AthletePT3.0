import { z } from "zod";

/**
 * Bereiche, auf die ein API-Key externer Apps zugreifen darf. Effektiv gilt immer die Schnittmenge
 * mit den Rechten des Nutzers, dem der Key gehört.
 *
 * `athletes:read` deckt nur die Athletenliste eines Coaches ab (ohne Anamnese), damit Coach-Tools
 * die IDs für Pläne und Protokolle kennen.
 */
export const apiKeyScopes = [
  "exercises:read",
  "exercises:write",
  "plans:read",
  "plans:write",
  "workouts:read",
  "workouts:write",
  "stats:read",
  "athletes:read",
] as const;
export const apiKeyScopeSchema = z.enum(apiKeyScopes);
export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;

/** Präfix jedes API-Keys. Macht Keys in Logs und bei Secret-Scannern erkennbar. */
export const API_KEY_PREFIX = "apt_";

/** Höchstens so viele nicht widerrufene, nicht abgelaufene Keys pro Nutzer. */
export const MAX_API_KEYS_PER_USER = 3;

/** Standard-Rate-Limit pro Key: Requests je 15 Minuten. */
export const API_KEY_DEFAULT_RATE_LIMIT = 300;
