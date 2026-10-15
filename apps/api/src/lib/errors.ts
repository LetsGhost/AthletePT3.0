import type { FieldError } from "@athletept/shared";

/**
 * Basisklasse für alle erwarteten Fehler. Der Error-Handler wandelt sie in eine
 * Problem-Details-Antwort um. Alles andere gilt als unerwartet und wird zu einer 500.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors?: FieldError[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(errors: FieldError[], message = "Die Anfrage ist ungültig") {
    super(400, "validation_failed", message, errors);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = "bad_request") {
    super(400, code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Nicht angemeldet", code = "unauthorized") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Keine Berechtigung", code = "forbidden") {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Nicht gefunden", code = "not_found") {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "conflict") {
    super(409, code, message);
  }
}
