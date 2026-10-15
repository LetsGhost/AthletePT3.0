import { z } from "zod";

import { isoDateSchema, objectIdSchema } from "./common";
import { emailSchema, personNameSchema, userStatusSchema } from "./user";

const text = (max: number) => z.string().trim().max(max, `Höchstens ${max} Zeichen`);

export const sexes = ["female", "male", "diverse"] as const;
export const sexSchema = z.enum(sexes);
export const sexLabels: Record<z.infer<typeof sexSchema>, string> = {
  female: "weiblich",
  male: "männlich",
  diverse: "divers",
};

/**
 * Anamnese eines Athleten. Alles optional: Der Coach kann nachtragen, was er beim
 * Erstgespräch noch nicht weiß. Enthält Gesundheitsdaten (DSGVO Art. 9).
 */
export const athleteProfileSchema = z.object({
  birthDate: isoDateSchema
    .refine((value) => {
      const year = Number(value.slice(0, 4));
      const now = new Date().getFullYear();
      return year >= now - 100 && year <= now - 5;
    }, "Bitte ein plausibles Geburtsdatum angeben")
    .optional(),
  sex: sexSchema.optional(),
  heightCm: z
    .number({ error: "Bitte eine Zahl angeben" })
    .int("Bitte in ganzen Zentimetern")
    .min(100, "Mindestens 100 cm")
    .max(250, "Höchstens 250 cm")
    .optional(),
  goal: text(200).optional(),
  focus: text(100).optional(),
  trainingsPerWeek: z
    .number({ error: "Bitte eine Zahl angeben" })
    .int("Bitte eine ganze Zahl angeben")
    .min(0)
    .max(14, "Höchstens 14")
    .optional(),
  trainingLocation: text(200).optional(),
  trainingTimes: text(200).optional(),
  otherSports: text(500).optional(),
  cardio: text(500).optional(),
  physicalIssues: text(1000).optional(),
  conditions: text(1000).optional(),
  /** Interne Notizen des Coaches, für den Athleten nicht sichtbar. */
  coachNotes: text(2000).optional(),
});

/**
 * Was der Coach dem Athleten selbst erlaubt. Standardmäßig ist alles aus.
 * - `ownPlan`: Trainingspläne selbst anlegen und bearbeiten (dieselben Rechte wie der Coach)
 * - `ownWeek`: den Wochenplan selbst bearbeiten
 */
export const athletePermissionsSchema = z.object({
  ownPlan: z.boolean(),
  ownWeek: z.boolean(),
});

export type AthletePermissions = z.infer<typeof athletePermissionsSchema>;
export type AthletePermission = keyof AthletePermissions;

export const athletePermissionKeys = [
  "ownPlan",
  "ownWeek",
] as const satisfies readonly AthletePermission[];

export const athletePermissionLabels: Record<
  AthletePermission,
  { label: string; description: string }
> = {
  ownPlan: {
    label: "Eigener Trainingsplan",
    description: "Kann Trainingspläne selbst anlegen, bearbeiten und aktivieren.",
  },
  ownWeek: {
    label: "Eigene Trainingswoche",
    description: "Kann den Wochenplan (Aktivitäten neben dem Krafttraining) selbst bearbeiten.",
  },
};

export const athleteSummarySchema = z.object({
  id: objectIdSchema,
  name: z.string(),
  email: z.string(),
  status: userStatusSchema,
  goal: z.string().nullable(),
  focus: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});

export const athleteDetailSchema = athleteSummarySchema.extend({
  profile: athleteProfileSchema,
  permissions: athletePermissionsSchema,
});

export const athleteQuotaInfoSchema = z.object({
  used: z.number().int(),
  limit: z.number().int(),
});

export const athleteListResponseSchema = z.object({
  items: z.array(athleteSummarySchema),
  quota: athleteQuotaInfoSchema,
});

export const createAthleteRequestSchema = z.object({
  email: emailSchema,
  name: personNameSchema,
  profile: athleteProfileSchema.default({}),
});

/**
 * `profile` ersetzt die Anamnese vollständig (nicht angegebene Felder werden geleert).
 * `permissions` ändert nur die angegebenen Berechtigungen.
 */
export const updateAthleteRequestSchema = z
  .object({
    name: personNameSchema,
    profile: athleteProfileSchema,
    permissions: athletePermissionsSchema.partial(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Keine Änderungen angegeben");

export type AthleteProfile = z.infer<typeof athleteProfileSchema>;
export type AthleteSummary = z.infer<typeof athleteSummarySchema>;
export type AthleteDetail = z.infer<typeof athleteDetailSchema>;
export type AthleteListResponse = z.infer<typeof athleteListResponseSchema>;
export type CreateAthleteRequest = z.input<typeof createAthleteRequestSchema>;
export type UpdateAthleteRequest = z.infer<typeof updateAthleteRequestSchema>;
