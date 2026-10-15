import { userRoleSchema } from "@athletept/shared";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { env } from "../../config/env";
import { UnauthorizedError } from "../../lib/errors";
import type { AuthContext } from "../../types/express";
import { UserModel } from "../users/user.model";

const ISSUER = "athletept-api";
const AUDIENCE = "athletept";

const payloadSchema = z.object({
  sub: z.string(),
  role: userRoleSchema,
  /** `tokenVersion` des Users beim Ausstellen (siehe `revokeAllSessions`). */
  tv: z.number().int().nonnegative(),
});

export interface AccessTokenClaims extends AuthContext {
  tokenVersion: number;
}

export function signAccessToken(claims: AccessTokenClaims) {
  return jwt.sign({ role: claims.role, tv: claims.tokenVersion }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: claims.userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

/** Prüft nur Signatur und Ablauf, ohne Datenbank. */
export function verifyAccessToken(token: string): AccessTokenClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Sitzung abgelaufen", "token_expired");
    }
    throw new UnauthorizedError("Ungültiges Token", "invalid_token");
  }

  const payload = payloadSchema.safeParse(decoded);
  if (!payload.success || !isValidObjectId(payload.data.sub)) {
    throw new UnauthorizedError("Ungültiges Token", "invalid_token");
  }
  return { userId: payload.data.sub, role: payload.data.role, tokenVersion: payload.data.tv };
}

/**
 * Prüft das Token und zusätzlich, ob es noch zum aktuellen Stand des Users passt. Gesperrte,
 * gelöschte oder überall abgemeldete User werden so sofort abgewiesen, nicht erst nach Ablauf.
 */
export async function resolveAccessToken(token: string): Promise<AuthContext> {
  const claims = verifyAccessToken(token);
  const user = await UserModel.findById(claims.userId, {
    status: 1,
    role: 1,
    tokenVersion: 1,
  }).lean();
  if (
    !user ||
    user.status !== "active" ||
    user.role !== claims.role ||
    (user.tokenVersion ?? 0) !== claims.tokenVersion
  ) {
    // Der Client versucht einen Refresh; der klappt nur, wenn die Sitzung noch gültig ist.
    throw new UnauthorizedError("Sitzung abgelaufen", "token_revoked");
  }
  return { userId: claims.userId, role: claims.role };
}
