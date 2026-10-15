import type { ZodError, ZodType, z } from "zod";

import { ValidationError } from "./errors";

export function zodIssuesToFieldErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

export function parseOrThrow<S extends ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(zodIssuesToFieldErrors(result.error));
  }
  return result.data;
}
