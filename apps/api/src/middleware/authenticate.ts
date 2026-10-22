import type { ApiKeyScope, UserRole } from "@athletept/shared";
import type { Request, RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "../lib/errors";
import {
  auditApiKeyWrite,
  isApiKeyToken,
  resolveApiKey,
} from "../modules/api-keys/api-key.service";
import { resolveAccessToken } from "../modules/auth/access-token";

/** Token aus `Authorization: Bearer …`, sonst `null`. */
export function bearerToken(req: Request) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  return scheme === "Bearer" && token ? token : null;
}

/**
 * Verlangt ein gültiges Bearer-Token eines aktiven Users und setzt `req.auth`. Akzeptiert neben
 * Access-Tokens auch API-Keys (`apt_…`); deren Schreibzugriffe werden protokolliert.
 */
export const authenticate: RequestHandler = async (req, res, next) => {
  const token = bearerToken(req);
  if (!token) {
    throw new UnauthorizedError();
  }
  if (isApiKeyToken(token)) {
    req.auth = await resolveApiKey(token);
    auditApiKeyWrite(req, res);
  } else {
    req.auth = await resolveAccessToken(token);
  }
  next();
};

/** Erlaubt nur die angegebenen Rollen. Muss nach `authenticate` laufen. */
export function requireRole(...roles: readonly UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(req.auth.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}

/**
 * Prüft Requests mit API-Key gegen den Scope der Route. Routen ohne Scope sind für API-Keys
 * gesperrt (Login, Passwort, Verwaltung, Moderation). `"any"`: jeder gültige Key. Muss nach
 * `authenticate` laufen; Requests mit Login-Sitzung lässt sie durch.
 */
export function requireApiKeyScope(scope: ApiKeyScope | "any" | undefined): RequestHandler {
  return (req, _res, next) => {
    const apiKey = req.auth?.apiKey;
    if (!apiKey) {
      next();
      return;
    }
    if (!scope) {
      throw new ForbiddenError(
        "Dieser Endpunkt ist mit API-Keys nicht erreichbar.",
        "api_key_route_forbidden",
      );
    }
    if (scope !== "any" && !apiKey.scopes.includes(scope)) {
      throw new ForbiddenError(`Dem API-Key fehlt der Bereich ${scope}.`, "api_key_scope_missing");
    }
    next();
  };
}
