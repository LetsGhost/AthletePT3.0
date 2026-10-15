import { z } from "zod";

/** 24-stellige hexadezimale MongoDB-ObjectId. */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Ungültige ID");

/** Kalenderdatum ohne Uhrzeit im Format YYYY-MM-DD. */
export const isoDateSchema = z.iso.date();

/** Einzelner Validierungsfehler innerhalb einer Problem-Antwort. */
export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

/**
 * Einheitliches Fehlerformat aller API-Antworten (RFC 9457 "Problem Details").
 * `code` ist ein stabiler, maschinenlesbarer Schlüssel für das Frontend.
 */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  errors: z.array(fieldErrorSchema).optional(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;
export type Problem = z.infer<typeof problemSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
