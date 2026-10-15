import { randomUUID } from "node:crypto";

import type { AuthResponse } from "@athletept/shared";
import type { Types } from "mongoose";

import { env } from "../../config/env";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../lib/errors";
import { logger } from "../../lib/logger/logger";
import { hashPassword, verifyPassword } from "../../lib/password";
import { generateToken, hashToken } from "../../lib/tokens";
import { UserModel, toUserDto, type UserDocument } from "../users/user.model";
import { signAccessToken } from "./access-token";
import { SessionModel } from "./session.model";

/**
 * Zeitfenster, in dem ein soeben rotiertes Refresh-Token noch einmal auftauchen darf, ohne als
 * Diebstahl zu gelten. Passiert, wenn zwei Tabs gleichzeitig refreshen.
 */
const ROTATION_GRACE_MS = 30_000;

export interface IssuedSession extends AuthResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface ClientMeta {
  userAgent?: string | undefined;
}

function invalidCredentials() {
  // Bewusst dieselbe Antwort für unbekannte E-Mail und falsches Passwort.
  return new UnauthorizedError("E-Mail oder Passwort ist falsch", "invalid_credentials");
}

export async function issueSession(
  user: UserDocument,
  meta: ClientMeta,
  familyId: string = randomUUID(),
): Promise<IssuedSession> {
  const refreshToken = generateToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await SessionModel.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: refreshExpiresAt,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });

  return {
    accessToken: signAccessToken({
      userId: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    }),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    user: toUserDto(user),
    refreshToken,
    refreshExpiresAt,
  };
}

export async function login(email: string, password: string, meta: ClientMeta) {
  const user = await UserModel.findOne({ email }).select("+passwordHash");
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) {
    throw invalidCredentials();
  }
  // Erst nach korrektem Passwort verraten, dass das Konto gesperrt ist.
  if (user.status === "disabled") {
    throw new ForbiddenError("Dein Konto ist deaktiviert", "account_disabled");
  }
  if (user.status !== "active") {
    throw invalidCredentials();
  }

  user.lastLoginAt = new Date();
  await user.save();
  return issueSession(user, meta);
}

export async function refresh(refreshToken: string, meta: ClientMeta) {
  const session = await SessionModel.findOne({ tokenHash: hashToken(refreshToken) });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError("Sitzung abgelaufen", "session_expired");
  }

  if (session.revokedAt) {
    const recentlyRotated =
      session.rotatedAt && Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
    if (recentlyRotated) {
      // Paralleler Refresh: Der Browser hat das neue Cookie bereits. Client soll es erneut versuchen.
      throw new ConflictError("Sitzung wurde gerade erneuert", "refresh_conflict");
    }
    logger.warn("Wiederverwendetes Refresh-Token, Session-Familie wird widerrufen", {
      userId: session.userId.toString(),
    });
    await revokeFamily(session.familyId);
    throw new UnauthorizedError("Sitzung abgelaufen", "session_expired");
  }

  const user = await UserModel.findById(session.userId);
  if (!user || user.status !== "active") {
    await revokeFamily(session.familyId);
    throw new UnauthorizedError("Sitzung abgelaufen", "session_expired");
  }

  // Atomar widerrufen, damit zwei parallele Requests nicht beide eine neue Session erzeugen.
  const claimed = await SessionModel.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { revokedAt: new Date(), rotatedAt: new Date() },
  );
  if (!claimed) {
    throw new ConflictError("Sitzung wurde gerade erneuert", "refresh_conflict");
  }

  return issueSession(user, meta, session.familyId);
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  const session = await SessionModel.findOne({ tokenHash: hashToken(refreshToken) });
  if (session) {
    await revokeFamily(session.familyId);
  }
}

async function revokeFamily(familyId: string) {
  await SessionModel.updateMany({ familyId, revokedAt: null }, { revokedAt: new Date() });
}

/**
 * Beendet alle Sitzungen eines Users, optional mit Ausnahme der aktuellen. Macht außerdem alle
 * ausgestellten Access-Tokens ungültig; die ausgenommene Sitzung holt sich per Refresh ein neues.
 */
export async function revokeAllSessions(userId: Types.ObjectId | string, exceptToken?: string) {
  const filter: Record<string, unknown> = { userId, revokedAt: null };
  if (exceptToken) {
    const current = await SessionModel.findOne({ tokenHash: hashToken(exceptToken) });
    if (current) filter.familyId = { $ne: current.familyId };
  }
  // Erst die Sitzungen, dann die Tokens: Ein abgewiesener Client kann sich so nicht mehr
  // zwischendurch per Refresh ein Token mit der neuen Version holen.
  await SessionModel.updateMany(filter, { revokedAt: new Date() });
  await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new NotFoundError("Benutzer nicht gefunden");
  }
  return toUserDto(user);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentRefreshToken: string | undefined,
) {
  const user = await UserModel.findById(userId).select("+passwordHash");
  if (!user) {
    throw new NotFoundError("Benutzer nicht gefunden");
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ForbiddenError("Das aktuelle Passwort ist falsch", "wrong_password");
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  // Andere Geräte abmelden, das aktuelle bleibt angemeldet.
  await revokeAllSessions(user._id, currentRefreshToken);
}
