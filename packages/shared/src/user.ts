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
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`)
  .max(PASSWORD_MAX_LENGTH, `Höchstens ${PASSWORD_MAX_LENGTH} Zeichen`);

// Erst normalisieren, dann prüfen, damit "  Max@Example.com " gültig ist.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Ungültige E-Mail-Adresse").max(254));

export const personNameSchema = z.string().trim().min(1, "Name fehlt").max(100);

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
