import {
  API_KEY_DEFAULT_RATE_LIMIT,
  API_KEY_PREFIX,
  MAX_API_KEYS_PER_USER,
  type ApiKeyScope,
} from "@athletept/shared";
import type { Request, Response } from "express";
import type { Types } from "mongoose";

import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "../../lib/errors";
import { logger } from "../../lib/logger/logger";
import { generateToken, hashToken } from "../../lib/tokens";
import type { AuthContext } from "../../types/express";
import { UserModel } from "../users/user.model";
import { ApiKeyAuditModel, ApiKeyModel } from "./api-key.model";

const API_KEY_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

/** Scopes, die nur für Coaches sinnvoll sind. */
const coachOnlyScopes: readonly ApiKeyScope[] = ["athletes:read"];

export function isApiKeyToken(token: string) {
  return token.startsWith(API_KEY_PREFIX);
}

/** Keys, die noch gültig sind oder es werden können. */
function countLiveKeys(userId: Types.ObjectId, now = new Date()) {
  return ApiKeyModel.countDocuments({
    userId,
    $or: [{ status: "pending" as const }, { status: "active" as const, expiresAt: { $gt: now } }],
  });
}

export interface CreateApiKeyInput {
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
  rateLimit?: number;
}

/**
 * Legt einen Key im Status `pending` an. Der eigentliche Key entsteht erst mit `issueApiKey`
 * (beim Abholen durch den Nutzer), damit der Sysadmin ihn nie zu sehen bekommt.
 *
 * Das Limit pro Nutzer wird ohne Transaktion geprüft: Keys legt nur der Sysadmin an, parallele
 * Anlagen für denselben Nutzer sind praktisch ausgeschlossen.
 */
export async function createApiKey(auth: AuthContext, input: CreateApiKeyInput) {
  const user = await UserModel.findById(input.userId, { role: 1, status: 1 }).lean();
  if (!user) throw new NotFoundError("Nutzer nicht gefunden");
  if (user.role === "sysadmin") {
    throw new BadRequestError("Sysadmins bekommen keine API-Keys.", "api_key_role_invalid");
  }
  if (user.status === "disabled") {
    throw new BadRequestError("Der Nutzer ist gesperrt.", "api_key_user_disabled");
  }
  const scopes = [...new Set(input.scopes)];
  if (scopes.length === 0) {
    throw new BadRequestError("Mindestens ein Bereich ist nötig.", "api_key_scope_invalid");
  }
  if (user.role !== "coach" && scopes.some((scope) => coachOnlyScopes.includes(scope))) {
    throw new BadRequestError("Diesen Bereich gibt es nur für Coaches.", "api_key_scope_invalid");
  }
  if ((await countLiveKeys(user._id)) >= MAX_API_KEYS_PER_USER) {
    throw new ConflictError(
      `Der Nutzer hat bereits ${MAX_API_KEYS_PER_USER} API-Keys.`,
      "api_key_limit_reached",
    );
  }

  return ApiKeyModel.create({
    userId: user._id,
    role: user.role,
    name: input.name,
    scopes,
    rateLimit: input.rateLimit ?? API_KEY_DEFAULT_RATE_LIMIT,
    createdById: auth.userId,
  });
}

/**
 * Erzeugt den Key eines `pending`-Eintrags und aktiviert ihn für ein Jahr. Liefert den Key im
 * Klartext; er ist danach nirgends mehr abrufbar.
 */
export async function issueApiKey(apiKeyId: string) {
  const plain = `${API_KEY_PREFIX}${generateToken()}`;
  const now = new Date();
  const apiKey = await ApiKeyModel.findOneAndUpdate(
    { _id: apiKeyId, status: "pending" },
    {
      $set: {
        status: "active",
        keyHash: hashToken(plain),
        keyPreview: plain.slice(0, API_KEY_PREFIX.length + 4),
        activatedAt: now,
        expiresAt: new Date(now.getTime() + API_KEY_LIFETIME_MS),
      },
    },
    { returnDocument: "after" },
  );
  if (!apiKey) throw new NotFoundError("API-Key nicht gefunden");
  return { apiKey, key: plain };
}

/** Zieht einen Key zurück. Wirkt sofort, auch für laufende Apps. */
export async function revokeApiKey(apiKeyId: string, revokedById: string) {
  const apiKey = await ApiKeyModel.findOneAndUpdate(
    { _id: apiKeyId, status: { $ne: "revoked" } },
    { $set: { status: "revoked", revokedAt: new Date(), revokedById } },
    { returnDocument: "after" },
  );
  if (!apiKey) throw new NotFoundError("API-Key nicht gefunden");
  return apiKey;
}

/**
 * Prüft einen API-Key und liefert den Auth-Kontext seines Nutzers. Gesperrte oder gelöschte Nutzer
 * und geänderte Rollen machen den Key sofort ungültig. Abmelden auf allen Geräten
 * (`tokenVersion`) betrifft Keys bewusst nicht; dafür gibt es den Widerruf.
 */
export async function resolveApiKey(token: string): Promise<AuthContext> {
  const apiKey = await ApiKeyModel.findOne({ keyHash: hashToken(token) }).lean();
  if (!apiKey || apiKey.status === "pending") {
    throw new UnauthorizedError("Ungültiger API-Key", "api_key_invalid");
  }
  if (apiKey.status === "revoked") {
    throw new UnauthorizedError("Der API-Key wurde zurückgezogen.", "api_key_revoked");
  }
  const now = new Date();
  if (!apiKey.expiresAt || apiKey.expiresAt <= now) {
    throw new UnauthorizedError("Der API-Key ist abgelaufen.", "api_key_expired");
  }
  const user = await UserModel.findById(apiKey.userId, { status: 1, role: 1 }).lean();
  if (!user || user.status !== "active" || user.role !== apiKey.role) {
    throw new UnauthorizedError("Ungültiger API-Key", "api_key_invalid");
  }

  await ApiKeyModel.updateOne(
    { _id: apiKey._id },
    { $set: { lastUsedAt: now }, $inc: { requestCount: 1 } },
  );

  return {
    userId: apiKey.userId.toString(),
    role: apiKey.role,
    apiKey: {
      id: apiKey._id.toString(),
      scopes: apiKey.scopes as ApiKeyScope[],
      rateLimit: apiKey.rateLimit,
    },
  };
}

const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protokolliert Schreibzugriffe über API-Keys, sobald die Antwort raus ist. Nur Methode, Pfad
 * (ohne Query) und Status, keine Inhalte. Fehler beim Schreiben brechen den Request nicht ab.
 */
export function auditApiKeyWrite(req: Request, res: Response) {
  const apiKey = req.auth?.apiKey;
  if (!apiKey || readMethods.has(req.method)) return;
  const userId = req.auth!.userId;
  res.on("finish", () => {
    ApiKeyAuditModel.create({
      apiKeyId: apiKey.id,
      userId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
    }).catch((error: unknown) => {
      logger.error("API-Key-Audit fehlgeschlagen", {
        apiKeyId: apiKey.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}
