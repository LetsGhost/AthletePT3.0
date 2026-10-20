import { z } from "zod";

import { objectIdSchema } from "./common";
import { emailSchema, userRoleSchema } from "./user";

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

/** Rate-Limit-Grenzen, die der Sysadmin pro Key setzen kann. */
export const API_KEY_MIN_RATE_LIMIT = 10;
export const API_KEY_MAX_RATE_LIMIT = 5000;

/** So lange ist der Abhol-Link aus der Mail gültig. */
export const API_KEY_PICKUP_DAYS = 7;

/**
 * - `pending`: angelegt, wartet auf Abholung über den Link aus der Mail
 * - `active`: gültig
 * - `expired`: Laufzeit (ein Jahr) vorbei
 * - `revoked`: zurückgezogen
 */
export const apiKeyStatuses = ["pending", "active", "expired", "revoked"] as const;
export const apiKeyStatusSchema = z.enum(apiKeyStatuses);
export type ApiKeyStatus = z.infer<typeof apiKeyStatusSchema>;

export const apiKeyNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen angeben")
  .max(60, "Höchstens 60 Zeichen");

export const apiKeyScopesSchema = z
  .array(apiKeyScopeSchema)
  .min(1, "Bitte mindestens einen Bereich wählen")
  .transform((scopes) => [...new Set(scopes)]);

export const apiKeyRateLimitSchema = z
  .number({ error: "Bitte eine Zahl angeben" })
  .int("Bitte eine ganze Zahl angeben")
  .min(API_KEY_MIN_RATE_LIMIT, `Mindestens ${API_KEY_MIN_RATE_LIMIT}`)
  .max(API_KEY_MAX_RATE_LIMIT, `Höchstens ${API_KEY_MAX_RATE_LIMIT}`);

/** Sicht des Nutzers auf seinen Key. Der Key selbst ist nie enthalten. */
export const apiKeySchema = z.object({
  id: objectIdSchema,
  name: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  status: apiKeyStatusSchema,
  /** Erste Zeichen des Keys zum Wiedererkennen, `null` vor dem Abholen. */
  keyPreview: z.string().nullable(),
  createdAt: z.string(),
  activatedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  /** Nur bei `pending`: bis wann der Abhol-Link gilt. */
  pickupExpiresAt: z.string().nullable(),
});

/** Sicht des Sysadmins: zusätzlich Nutzer, Limit und Nutzung, nie Trainingsinhalte. */
export const adminApiKeySchema = apiKeySchema.extend({
  user: z.object({
    id: objectIdSchema,
    name: z.string(),
    email: z.string(),
    role: userRoleSchema,
  }),
  rateLimit: z.number().int(),
  requestCount: z.number().int(),
  revokedAt: z.string().nullable(),
  /** Erneuerung: ID des Keys, den dieser ablöst. */
  renewedFromId: objectIdSchema.nullable(),
});

/** So lange vor dem Ablauf weisen Mail und Admin-Liste auf die nötige Erneuerung hin. */
export const API_KEY_EXPIRY_NOTICE_DAYS = 14;

export const createApiKeyRequestSchema = z.object({
  /** E-Mail des Coaches oder Athleten, dem der Key gehört. */
  email: emailSchema,
  name: apiKeyNameSchema,
  scopes: apiKeyScopesSchema,
  rateLimit: apiKeyRateLimitSchema.default(API_KEY_DEFAULT_RATE_LIMIT),
});

/** Nur einschränken: `scopes` muss eine Teilmenge der bisherigen sein. */
export const updateApiKeyRequestSchema = z
  .object({
    name: apiKeyNameSchema,
    scopes: apiKeyScopesSchema,
    rateLimit: apiKeyRateLimitSchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Keine Änderungen angegeben");

/** Antwort auf Anlage bzw. neuen Abhol-Link: Die Mail kann fehlschlagen, ohne dass die Anlage scheitert. */
export const apiKeyPickupLinkResultSchema = z.object({ mailSent: z.boolean() });

export const apiKeyPickupTokenSchema = z.object({ token: z.string().min(1).max(200) });

export const apiKeyPickupInfoSchema = z.object({
  name: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  pickupExpiresAt: z.string(),
});

export const apiKeyPickupRequestSchema = apiKeyPickupTokenSchema.extend({
  /** Bestätigung, dass die App mit diesen Bereichen auf die eigenen Daten zugreifen darf. */
  acceptDataAccess: z.literal(true, { error: "Bitte bestätige den Datenzugriff." }),
});

export const apiKeyPickupResponseSchema = z.object({
  /** Der Key im Klartext. Wird genau einmal ausgeliefert. */
  key: z.string(),
  apiKey: apiKeySchema,
});

export const apiKeyAuditEntrySchema = z.object({
  method: z.string(),
  path: z.string(),
  status: z.number().int(),
  createdAt: z.string(),
});

export const apiKeyAuditListSchema = z.object({ items: z.array(apiKeyAuditEntrySchema) });

/**
 * Herkunft der letzten Änderung eines Plans, Trainings oder einer Übung: `null` aus der Web-App,
 * sonst der Name der externen App.
 */
export const writeSourceSchema = z.object({ appName: z.string() }).nullable();

export type WriteSource = z.infer<typeof writeSourceSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type AdminApiKey = z.infer<typeof adminApiKeySchema>;
export type CreateApiKeyRequest = z.input<typeof createApiKeyRequestSchema>;
export type UpdateApiKeyRequest = z.input<typeof updateApiKeyRequestSchema>;
export type ApiKeyPickupInfo = z.infer<typeof apiKeyPickupInfoSchema>;
export type ApiKeyPickupResponse = z.infer<typeof apiKeyPickupResponseSchema>;
export type ApiKeyAuditEntry = z.infer<typeof apiKeyAuditEntrySchema>;
