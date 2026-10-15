import { z } from "zod";

import { objectIdSchema } from "./common";

export const userRoles = ["sysadmin", "coach", "athlete"] as const;
export const userRoleSchema = z.enum(userRoles);
export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * - `invited`: Konto angelegt, Passwort noch nicht gesetzt
 * - `active`: kann sich anmelden
 * - `disabled`: gesperrt, Daten bleiben erhalten
 */
export const userStatuses = ["invited", "active", "disabled"] as const;
export const userStatusSchema = z.enum(userStatuses);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

/** bcrypt wertet nur die ersten 72 Bytes aus; alles danach würde stillschweigend ignoriert. */
const PASSWORD_MAX_BYTES = 72;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`)
  .max(PASSWORD_MAX_LENGTH, `Höchstens ${PASSWORD_MAX_LENGTH} Zeichen`)
  .refine(
    (value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES,
    "Zu lang: Umlaute und Sonderzeichen zählen mehrfach. Bitte kürze das Passwort.",
  );

// Erst normalisieren, dann prüfen, damit "  Max@Example.com " gültig ist.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Ungültige E-Mail-Adresse").max(254));

export const personNameSchema = z
  .string()
  .trim()
  .min(1, "Name fehlt")
  .max(100)
  // Steuerzeichen wie Zeilenumbrüche landen sonst im Klartext-Teil von Mails.
  .regex(/^\P{Cc}*$/u, "Der Name darf keine Zeilenumbrüche oder Steuerzeichen enthalten");

/** Öffentliche Darstellung eines Users. Enthält nie Passwort-Daten. */
export const userSchema = z.object({
  id: objectIdSchema,
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
  coachId: objectIdSchema.nullable(),
  createdAt: z.string(),
});

export type User = z.infer<typeof userSchema>;
