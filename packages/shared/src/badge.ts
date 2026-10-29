import { z } from "zod";

import { badgeTierSchema, challengeKindSchema } from "./challenge";

/**
 * Spitzname für globale Ranglisten und Duelle mit anderen Teams. Eindeutig ohne Rücksicht auf
 * Groß- und Kleinschreibung.
 */
export const nicknameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,20}$/, "3–20 Zeichen: Buchstaben, Zahlen und _");

export const challengeSettingsSchema = z.object({
  nickname: z.string().nullable(),
  /** Mails zu Challenges (Einladungen, neue Challenges, Ergebnisse). */
  challengeMails: z.boolean(),
});

export const updateChallengeSettingsRequestSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    challengeMails: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), "Keine Änderung angegeben");

export const nicknameCheckQuerySchema = z.object({ nickname: z.string().max(40) });

export const nicknameCheckResponseSchema = z.object({
  available: z.boolean(),
  /** Freie Vorschläge, wenn der Name vergeben oder ungültig ist. */
  suggestions: z.array(z.string()),
});

export const badgeGroups = ["series", "records", "challenges"] as const;
export const badgeGroupSchema = z.enum(badgeGroups);
export type BadgeGroup = z.infer<typeof badgeGroupSchema>;
export const badgeGroupLabels: Record<BadgeGroup, string> = {
  series: "Serie",
  records: "Rekorde",
  challenges: "Challenges",
};

/** Abzeichen werden aus Trainings und Challenges berechnet, nichts davon ist gespeichert. */
export const badgeSchema = z.object({
  /** Stabil, z. B. `streak` oder `system:<Runden-ID>`. */
  id: z.string(),
  group: badgeGroupSchema,
  name: z.string(),
  description: z.string(),
  /** Icon-Schlüssel für die Oberfläche. */
  icon: z.enum(["flame", "calendar", "volume", "sunrise", "duel", "coach", "system"]),
  /** Art der Challenge für die Farbe, `null` bei Serie und Rekorden. */
  challengeKind: challengeKindSchema.nullable(),
  tier: badgeTierSchema.nullable(),
  /** Schwellen als Text, z. B. „2 Wo.“, „4 Wo.“, „8 Wo.“ */
  thresholds: z.array(z.string()),
  /** Stand in Worten, z. B. „Silber · 5 Wochen“ oder „Noch offen · 1 von 2 Wochen“. */
  progress: z.string(),
  /** Verlinkte Challenge, z. B. die System-Runde. */
  challengeId: z.string().nullable(),
});

export const badgeListResponseSchema = z.object({
  items: z.array(badgeSchema),
  earnedCount: z.number().int(),
});

export type ChallengeSettings = z.infer<typeof challengeSettingsSchema>;
export type UpdateChallengeSettingsRequest = z.input<typeof updateChallengeSettingsRequestSchema>;
export type NicknameCheckResponse = z.infer<typeof nicknameCheckResponseSchema>;
export type Badge = z.infer<typeof badgeSchema>;
export type BadgeListResponse = z.infer<typeof badgeListResponseSchema>;
