import type { UserRole } from "@athletept/shared";
import type { Request, RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "../lib/errors";
import { resolveAccessToken } from "../modules/auth/access-token";

/** Token aus `Authorization: Bearer …`, sonst `null`. */
export function bearerToken(req: Request) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  return scheme === "Bearer" && token ? token : null;
}

/** Verlangt ein gültiges Bearer-Token eines aktiven Users und setzt `req.auth`. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) {
    throw new UnauthorizedError();
  }
  req.auth = await resolveAccessToken(token);
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
