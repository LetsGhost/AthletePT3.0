import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError, errorMessage } from "./http";

/**
 * Überträgt Feldfehler einer API-Antwort auf das Formular. Gibt eine allgemeine
 * Fehlermeldung zurück, wenn sich der Fehler keinem Feld zuordnen lässt.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (error instanceof ApiError && error.errors.length > 0) {
    let unmatched = false;
    for (const fieldError of error.errors) {
      const field = fields.find((name) => name === fieldError.path);
      if (field) {
        setError(field, { type: "server", message: fieldError.message });
      } else {
        unmatched = true;
      }
    }
    return unmatched ? error.message : null;
  }
  return errorMessage(error);
}
