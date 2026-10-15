import { userRoleSchema } from "@athletept/shared";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../../config/env";
import { UnauthorizedError } from "../../lib/errors";
import type { AuthContext } from "../../types/express";

const ISSUER = "athletept-api";
const AUDIENCE = "athletept";

const payloadSchema = z.object({
  sub: z.string(),
  role: userRoleSchema,
});

export function signAccessToken(auth: AuthContext) {
  return jwt.sign({ role: auth.role }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: auth.userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AuthContext {
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
  if (!payload.success) {
    throw new UnauthorizedError("Ungültiges Token", "invalid_token");
  }
  return { userId: payload.data.sub, role: payload.data.role };
}
