import type { FieldError, Problem } from "@athletept/shared";
import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";

import { AppError } from "../lib/errors";
import { logger } from "../lib/logger/logger";
import { zodIssuesToFieldErrors } from "../lib/validation";

const titles: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

export function sendProblem(
  res: Response,
  status: number,
  code: string,
  detail: string,
  errors?: FieldError[],
) {
  const problem: Problem = {
    type: "about:blank",
    title: titles[status] ?? "Error",
    status,
    code,
    detail,
    ...(errors?.length ? { errors } : {}),
  };
  res.status(status).type("application/problem+json").json(problem);
}

function isMongoDuplicateKey(error: unknown): error is { code: 11000; keyValue?: object } {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000
  );
}

/** Wandelt jeden Fehler in eine Problem-Details-Antwort um. Interna gelangen nie an den Client. */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    sendProblem(res, error.status, error.code, error.message, error.errors);
    return;
  }

  if (error instanceof ZodError) {
    sendProblem(
      res,
      400,
      "validation_failed",
      "Die Anfrage ist ungültig",
      zodIssuesToFieldErrors(error),
    );
    return;
  }

  // body-parser: kaputtes JSON bzw. zu großer Body
  const httpError = error as { type?: string; status?: number };
  if (httpError.type === "entity.parse.failed") {
    sendProblem(res, 400, "invalid_json", "Der Request-Body ist kein gültiges JSON");
    return;
  }
  if (httpError.type === "entity.too.large") {
    sendProblem(res, 413, "payload_too_large", "Der Request-Body ist zu groß");
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    sendProblem(res, 400, "invalid_id", "Ungültige ID");
    return;
  }

  if (isMongoDuplicateKey(error)) {
    sendProblem(res, 409, "duplicate", "Eintrag existiert bereits");
    return;
  }

  logger.error("Unbehandelter Fehler", {
    method: req.method,
    path: req.path,
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  sendProblem(res, 500, "internal_error", "Ein unerwarteter Fehler ist aufgetreten");
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendProblem(res, 404, "route_not_found", "Diesen Endpunkt gibt es nicht");
};
