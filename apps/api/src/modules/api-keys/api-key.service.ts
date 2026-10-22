import {
  API_KEY_DEFAULT_RATE_LIMIT,
  API_KEY_EXPIRY_NOTICE_DAYS,
  API_KEY_PICKUP_DAYS,
  API_KEY_PREFIX,
  createApiKeyRequestSchema,
  MAX_API_KEYS_PER_USER,
  updateApiKeyRequestSchema,
  type AdminApiKey,
  type ApiKey,
  type ApiKeyPickupInfo,
  type ApiKeyScope,
  type ApiKeyStatus,
  type CreateApiKeyRequest,
  type UpdateApiKeyRequest,
} from "@athletept/shared";
import type { Request, Response } from "express";
import type { Types } from "mongoose";

import { env } from "../../config/env";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../lib/errors";
import { logger } from "../../lib/logger/logger";
import { trySendMail } from "../../lib/mail/mailer";
import { apiKeyExpiryMail, apiKeyPickupMail } from "../../lib/mail/templates";
import { generateToken, hashToken } from "../../lib/tokens";
import type { AuthContext } from "../../types/express";
import { UserModel, type UserDocument } from "../users/user.model";
import { ApiKeyAuditModel, ApiKeyModel, type ApiKeyDocument } from "./api-key.model";

const DAY_MS = 24 * 60 * 60 * 1000;
const API_KEY_LIFETIME_MS = 365 * DAY_MS;

/** Scopes, die nur für Coaches sinnvoll sind. */
const coachOnlyScopes: readonly ApiKeyScope[] = ["athletes:read"];

export function isApiKeyToken(token: string) {
  return token.startsWith(API_KEY_PREFIX);
}

/** Filter für Keys, die noch gültig sind oder es werden können. */
function liveKeys(now = new Date()) {
  return {
    $or: [{ status: "pending" as const }, { status: "active" as const, expiresAt: { $gt: now } }],
  };
}

/** Keys, die noch gültig sind oder es werden können. `except`: bei Erneuerung der alte Key. */
function countLiveKeys(userId: Types.ObjectId, except?: Types.ObjectId) {
  return ApiKeyModel.countDocuments({
    userId,
    ...(except ? { _id: { $ne: except } } : {}),
    ...liveKeys(),
  });
}

export interface CreateApiKeyInput {
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
  rateLimit?: number;
  /** Erneuerung: dieser Key wird abgelöst und zählt nicht aufs Limit. */
  renewedFromId?: Types.ObjectId;
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
  if ((await countLiveKeys(user._id, input.renewedFromId)) >= MAX_API_KEYS_PER_USER) {
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
    renewedFromId: input.renewedFromId ?? null,
  });
}

/**
 * Erneuert einen aktiven oder abgelaufenen Key: neuer Key mit denselben Einstellungen, der Nutzer
 * holt ihn über einen neuen Link ab. Der alte bleibt bis zu seinem Ablauf gültig, damit die App
 * nicht hart abbricht. Pro Key nur eine laufende Erneuerung.
 */
export async function renewApiKey(auth: AuthContext, apiKeyId: string) {
  const original = await ApiKeyModel.findOne({ _id: apiKeyId, status: "active" });
  if (!original) {
    throw new ConflictError(
      "Nur abgeholte, nicht zurückgezogene Keys lassen sich erneuern.",
      "api_key_not_renewable",
    );
  }
  if (await ApiKeyModel.exists({ renewedFromId: original._id, ...liveKeys() })) {
    throw new ConflictError("Der Key wurde bereits erneuert.", "api_key_already_renewed");
  }
  const renewed = await createApiKey(auth, {
    userId: original.userId.toString(),
    name: original.name,
    scopes: original.scopes as ApiKeyScope[],
    rateLimit: original.rateLimit,
    renewedFromId: original._id,
  });
  const { mailSent } = await sendPickupLink(renewed._id.toString());
  return { ...(await getAdminApiKey(renewed._id.toString())), mailSent };
}

/**
 * Schickt Nutzern eine Mail, deren Key in den nächsten 14 Tagen abläuft. Jeder Key nur einmal;
 * bereits erneuerte Keys nicht. Liefert die Anzahl verschickter Hinweise.
 */
export async function sendExpiryNotices(now = new Date()) {
  const due = await ApiKeyModel.find({
    status: "active",
    expiryNoticeSentAt: null,
    expiresAt: { $gt: now, $lte: new Date(now.getTime() + API_KEY_EXPIRY_NOTICE_DAYS * DAY_MS) },
  });
  let sent = 0;
  for (const apiKey of due) {
    if (await ApiKeyModel.exists({ renewedFromId: apiKey._id, ...liveKeys(now) })) continue;
    // Erst markieren, dann senden: Lieber eine Mail verlieren als bei jedem Lauf erneut schicken.
    const claimed = await ApiKeyModel.updateOne(
      { _id: apiKey._id, expiryNoticeSentAt: null },
      { $set: { expiryNoticeSentAt: now } },
    );
    if (claimed.modifiedCount === 0) continue;
    const user = await UserModel.findById(apiKey.userId, { email: 1, name: 1 }).lean();
    if (!user) continue;
    const ok = await trySendMail(
      apiKeyExpiryMail({
        to: user.email,
        name: user.name,
        appName: apiKey.name,
        expiresAt: apiKey.expiresAt!,
      }),
    );
    if (ok) sent += 1;
  }
  return sent;
}

/** Coach oder Athlet mit dieser E-Mail, dem der Sysadmin einen Key geben will. */
async function findKeyHolder(email: string) {
  const user = await UserModel.findOne({ email, role: { $in: ["coach", "athlete"] } });
  if (!user) throw new NotFoundError("Kein Coach oder Athlet mit dieser E-Mail-Adresse");
  return user._id.toString();
}

/** Legt einen Key für den Nutzer mit der E-Mail an und schickt ihm den Abhol-Link. */
export async function createApiKeyForEmail(auth: AuthContext, input: CreateApiKeyRequest) {
  const parsed = createApiKeyRequestSchema.parse(input);
  const apiKey = await createApiKey(auth, { ...parsed, userId: await findKeyHolder(parsed.email) });
  const { mailSent } = await sendPickupLink(apiKey._id.toString());
  return { ...(await getAdminApiKey(apiKey._id.toString())), mailSent };
}

/** Link zur Abholseite. Das Token steht im Fragment (#), damit es nie in Server-Logs landet. */
export function pickupUrl(token: string) {
  return `${env.APP_URL}/api-zugang#token=${token}`;
}

/**
 * Erzeugt einen neuen Abhol-Link für einen `pending`-Key und schickt ihn per Mail. Ein vorheriger
 * Link wird ungültig.
 */
export async function sendPickupLink(apiKeyId: string) {
  const token = generateToken();
  const apiKey = await ApiKeyModel.findOneAndUpdate(
    { _id: apiKeyId, status: "pending" },
    {
      $set: {
        pickupTokenHash: hashToken(token),
        pickupExpiresAt: new Date(Date.now() + API_KEY_PICKUP_DAYS * DAY_MS),
      },
    },
    { returnDocument: "after" },
  );
  if (!apiKey) {
    throw new ConflictError(
      "Nur nicht abgeholte Keys bekommen einen neuen Link.",
      "api_key_not_pending",
    );
  }
  const user = await UserModel.findById(apiKey.userId, { email: 1, name: 1 }).lean();
  if (!user) throw new NotFoundError("Nutzer nicht gefunden");
  const mailSent = await trySendMail(
    apiKeyPickupMail({
      to: user.email,
      name: user.name,
      appName: apiKey.name,
      url: pickupUrl(token),
      validDays: API_KEY_PICKUP_DAYS,
    }),
  );
  return { mailSent };
}

/** Aktiviert einen `pending`-Key für ein Jahr und liefert den Key im Klartext. */
async function activate(
  filter: { _id: string | Types.ObjectId; pickupTokenHash?: string },
  extra: { dataAccessAcceptedAt?: Date } = {},
) {
  const plain = `${API_KEY_PREFIX}${generateToken()}`;
  const now = new Date();
  const apiKey = await ApiKeyModel.findOneAndUpdate(
    { ...filter, status: "pending" },
    {
      $set: {
        ...extra,
        status: "active",
        keyHash: hashToken(plain),
        keyPreview: plain.slice(0, API_KEY_PREFIX.length + 4),
        activatedAt: now,
        expiresAt: new Date(now.getTime() + API_KEY_LIFETIME_MS),
        pickupTokenHash: null,
        pickupExpiresAt: null,
      },
    },
    { returnDocument: "after" },
  );
  return apiKey ? { apiKey, key: plain } : null;
}

/** Aktiviert einen Key ohne Abhol-Link (Tests, Skripte). */
export async function issueApiKey(apiKeyId: string) {
  const issued = await activate({ _id: apiKeyId });
  if (!issued) throw new NotFoundError("API-Key nicht gefunden");
  return issued;
}

function invalidPickupLink() {
  return new BadRequestError(
    "Der Link ist ungültig, abgelaufen oder wurde schon benutzt. Bitte wende dich an den Sysadmin.",
    "invalid_token",
  );
}

/**
 * Prüft einen Abhol-Link. Er gilt nur für den angemeldeten Nutzer, dem der Key gehört: Wer den
 * Link sonst in die Hände bekommt (z. B. weitergeleitete Mail), kann ihn nicht einlösen.
 */
async function findPickup(auth: AuthContext, token: string) {
  const apiKey = await ApiKeyModel.findOne({
    pickupTokenHash: hashToken(token),
    status: "pending",
    pickupExpiresAt: { $gt: new Date() },
  });
  if (!apiKey) throw invalidPickupLink();
  if (apiKey.userId.toString() !== auth.userId || apiKey.role !== auth.role) {
    throw new ForbiddenError(
      "Dieser Link gehört zu einem anderen Konto. Melde dich mit dem Konto an, an das die Mail ging.",
      "api_key_pickup_wrong_user",
    );
  }
  return apiKey;
}

export async function inspectPickup(auth: AuthContext, token: string): Promise<ApiKeyPickupInfo> {
  const apiKey = await findPickup(auth, token);
  return {
    name: apiKey.name,
    scopes: apiKey.scopes as ApiKeyScope[],
    pickupExpiresAt: apiKey.pickupExpiresAt!.toISOString(),
  };
}

/** Löst den Abhol-Link ein. Atomar: Zwei gleichzeitige Einlösungen können nicht beide gelingen. */
export async function pickUpApiKey(auth: AuthContext, token: string) {
  const apiKey = await findPickup(auth, token);
  const issued = await activate(
    { _id: apiKey._id, pickupTokenHash: hashToken(token) },
    { dataAccessAcceptedAt: new Date() },
  );
  if (!issued) throw invalidPickupLink();
  return { key: issued.key, apiKey: toApiKeyDto(issued.apiKey) };
}

/** Zieht einen Key zurück. Wirkt sofort, auch für laufende Apps. */
export async function revokeApiKey(apiKeyId: string, revokedById: string) {
  const apiKey = await ApiKeyModel.findOneAndUpdate(
    { _id: apiKeyId, status: { $ne: "revoked" } },
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
        revokedById,
        pickupTokenHash: null,
        pickupExpiresAt: null,
      },
    },
    { returnDocument: "after" },
  );
  if (!apiKey) throw new NotFoundError("API-Key nicht gefunden");
  return apiKey;
}

/** Widerruf durch den Nutzer selbst, nur für eigene Keys. */
export async function revokeMyApiKey(auth: AuthContext, apiKeyId: string) {
  if (!(await ApiKeyModel.exists({ _id: apiKeyId, userId: auth.userId }))) {
    throw new NotFoundError("API-Key nicht gefunden");
  }
  return toApiKeyDto(await revokeApiKey(apiKeyId, auth.userId));
}

/**
 * Ändert Name und Rate-Limit oder schränkt die Bereiche ein. Mehr Rechte gibt es nur über einen
 * neuen Key, damit der Nutzer jede Erweiterung bewusst abholt und bestätigt.
 */
export async function updateApiKey(apiKeyId: string, input: UpdateApiKeyRequest) {
  const changes = updateApiKeyRequestSchema.parse(input);
  const apiKey = await ApiKeyModel.findOne({ _id: apiKeyId, status: { $ne: "revoked" } });
  if (!apiKey) throw new NotFoundError("API-Key nicht gefunden");
  if (changes.scopes?.some((scope) => !apiKey.scopes.includes(scope))) {
    throw new BadRequestError(
      "Bereiche lassen sich nur einschränken. Für mehr Rechte einen neuen Key anlegen.",
      "api_key_scope_extension",
    );
  }
  if (changes.name !== undefined) apiKey.name = changes.name;
  if (changes.scopes !== undefined) apiKey.scopes = changes.scopes;
  if (changes.rateLimit !== undefined) apiKey.rateLimit = changes.rateLimit;
  await apiKey.save();
  return getAdminApiKey(apiKeyId);
}

function iso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function statusOf(apiKey: ApiKeyDocument, now = new Date()): ApiKeyStatus {
  if (apiKey.status === "active" && (!apiKey.expiresAt || apiKey.expiresAt <= now)) {
    return "expired";
  }
  return apiKey.status;
}

export function toApiKeyDto(apiKey: ApiKeyDocument): ApiKey {
  return {
    id: apiKey._id.toString(),
    name: apiKey.name,
    scopes: apiKey.scopes as ApiKeyScope[],
    status: statusOf(apiKey),
    keyPreview: apiKey.keyPreview ?? null,
    createdAt: apiKey.createdAt.toISOString(),
    activatedAt: iso(apiKey.activatedAt),
    expiresAt: iso(apiKey.expiresAt),
    lastUsedAt: iso(apiKey.lastUsedAt),
    pickupExpiresAt: apiKey.status === "pending" ? iso(apiKey.pickupExpiresAt) : null,
  };
}

function toAdminApiKeyDto(apiKey: ApiKeyDocument, user: UserDocument | undefined): AdminApiKey {
  return {
    ...toApiKeyDto(apiKey),
    user: {
      id: apiKey.userId.toString(),
      name: user?.name ?? "Gelöschter Nutzer",
      email: user?.email ?? "",
      role: apiKey.role,
    },
    rateLimit: apiKey.rateLimit,
    requestCount: apiKey.requestCount,
    renewedFromId: apiKey.renewedFromId?.toString() ?? null,
    revokedAt: iso(apiKey.revokedAt),
  };
}

/** Alle Keys für den Sysadmin, neueste zuerst. */
export async function listApiKeys(): Promise<AdminApiKey[]> {
  const apiKeys = await ApiKeyModel.find().sort({ createdAt: -1, _id: -1 });
  const users = await UserModel.find({ _id: { $in: apiKeys.map((k) => k.userId) } });
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  return apiKeys.map((apiKey) => toAdminApiKeyDto(apiKey, byId.get(apiKey.userId.toString())));
}

export async function getAdminApiKey(apiKeyId: string) {
  const apiKey = await ApiKeyModel.findById(apiKeyId);
  if (!apiKey) throw new NotFoundError("API-Key nicht gefunden");
  const user = await UserModel.findById(apiKey.userId);
  return toAdminApiKeyDto(apiKey, user ?? undefined);
}

export async function listMyApiKeys(userId: string): Promise<ApiKey[]> {
  const apiKeys = await ApiKeyModel.find({ userId }).sort({ createdAt: -1, _id: -1 });
  return apiKeys.map((apiKey) => toApiKeyDto(apiKey));
}

const AUDIT_LIST_LIMIT = 100;

/** Letzte Schreibzugriffe eines Keys (ohne Inhalte). */
export async function listAudit(apiKeyId: string) {
  if (!(await ApiKeyModel.exists({ _id: apiKeyId }))) {
    throw new NotFoundError("API-Key nicht gefunden");
  }
  const entries = await ApiKeyAuditModel.find({ apiKeyId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(AUDIT_LIST_LIMIT)
    .lean();
  return {
    items: entries.map((entry) => ({
      method: entry.method,
      path: entry.path,
      status: entry.status,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
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
      name: apiKey.name,
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
