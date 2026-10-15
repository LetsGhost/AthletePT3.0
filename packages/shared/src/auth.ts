import { z } from "zod";

import { emailSchema, passwordSchema, userRoleSchema, userSchema } from "./user";

export const loginRequestSchema = z.object({
  email: emailSchema,
  // Beim Login keine Längenregel prüfen, sonst verrät die Antwort die Passwort-Policy.
  password: z.string().min(1, "Passwort fehlt").max(1024),
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  /** Laufzeit des Access-Tokens in Sekunden. */
  expiresIn: z.number().int(),
  user: userSchema,
});

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort fehlt"),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "Das neue Passwort muss sich vom alten unterscheiden",
  });

/** Einmal-Token aus Einladungs- und Reset-Links. */
export const oneTimeTokenSchema = z.string().min(20, "Ungültiger Link").max(200, "Ungültiger Link");

export const tokenRequestSchema = z.object({ token: oneTimeTokenSchema });

export const invitationInfoSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: userRoleSchema,
  /** Athleten müssen beim Annehmen in die Verarbeitung ihrer Gesundheitsdaten einwilligen. */
  healthDataConsentRequired: z.boolean(),
});

/** Ausdrückliche Einwilligung in die Verarbeitung von Gesundheitsdaten (Art. 9 Abs. 2 lit. a DSGVO). */
export const healthDataConsentSchema = z.object({
  accepted: z.literal(true, "Bitte willige in die Verarbeitung deiner Gesundheitsdaten ein"),
  /** Version der Datenschutzerklärung, die beim Einwilligen angezeigt wurde. */
  privacyPolicyVersion: z.string().min(1).max(50),
});

export const acceptInvitationRequestSchema = z.object({
  token: oneTimeTokenSchema,
  password: passwordSchema,
  /** Pflicht für Athleten, bei Coaches ignoriert. */
  healthDataConsent: healthDataConsentSchema.optional(),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z.object({
  token: oneTimeTokenSchema,
  password: passwordSchema,
});

export type LoginRequest = z.input<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type InvitationInfo = z.infer<typeof invitationInfoSchema>;
export type HealthDataConsent = z.infer<typeof healthDataConsentSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
export type PasswordResetRequest = z.input<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;
