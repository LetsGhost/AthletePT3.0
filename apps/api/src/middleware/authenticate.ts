import type { UserRole } from "@athletept/shared";
import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "../lib/errors";
import { verifyAccessToken } from "../modules/auth/access-token";

/** Verlangt ein gültiges Bearer-Token und setzt `req.auth`. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const [scheme, token] = header?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError();
  }
  req.auth = verifyAccessToken(token);
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
