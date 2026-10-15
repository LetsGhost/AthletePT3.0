import { z } from "zod";

import { objectIdSchema } from "./common";
import { emailSchema, personNameSchema, userStatusSchema } from "./user";

export const MAX_ATHLETE_QUOTA = 500;

export const athleteQuotaSchema = z
  .number({ error: "Bitte eine Zahl angeben" })
  .int("Bitte eine ganze Zahl angeben")
  .min(0, "Darf nicht negativ sein")
  .max(MAX_ATHLETE_QUOTA, `Höchstens ${MAX_ATHLETE_QUOTA}`);

export const coachSchema = z.object({
  id: objectIdSchema,
  email: z.string(),
  name: z.string(),
  status: userStatusSchema,
  /** Wie viele aktive oder eingeladene Athleten der Coach haben darf. */
  athleteQuota: z.number().int(),
  /** Aktive und eingeladene Athleten (archivierte zählen nicht). */
  athleteCount: z.number().int(),
  /** Archivierte Athleten. Gehen beim Sperren des Coaches mit an den neuen Coach. */
  archivedAthleteCount: z.number().int(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});

export const createCoachRequestSchema = z.object({
  email: emailSchema,
  name: personNameSchema,
  athleteQuota: athleteQuotaSchema,
});

export const updateCoachRequestSchema = z
  .object({
    name: personNameSchema,
    athleteQuota: athleteQuotaSchema,
    /** Nur aktivieren oder sperren. Eingeladen bleibt eingeladen, bis die Einladung angenommen ist. */
    status: z.enum(["active", "disabled"]),
    /**
     * Pflicht beim Sperren eines Coaches mit Athleten: aktiver Coach, der alle seine Athleten
     * (auch archivierte) übernimmt. Sein Kontingent muss für die nicht archivierten reichen.
     */
    reassignToCoachId: objectIdSchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Keine Änderungen angegeben");

/** Antwort auf Anlage bzw. erneute Einladung: Die Mail kann fehlschlagen, ohne dass die Anlage scheitert. */
export const invitationResultSchema = z.object({
  inviteSent: z.boolean(),
});

export type Coach = z.infer<typeof coachSchema>;
export type CreateCoachRequest = z.infer<typeof createCoachRequestSchema>;
export type UpdateCoachRequest = z.infer<typeof updateCoachRequestSchema>;
