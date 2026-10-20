import { apiKeyScopes, API_KEY_DEFAULT_RATE_LIMIT, userRoles } from "@athletept/shared";
import { Schema, model, type HydratedDocumentFromSchema } from "mongoose";

/** Gespeicherter Status. `expired` wird erst in der API-Antwort aus `expiresAt` abgeleitet. */
export const storedApiKeyStatuses = ["pending", "active", "revoked"] as const;

/**
 * API-Key einer externen App. Gehört einem Nutzer (Coach oder Athlet) und handelt in dessen
 * Namen. Anlegen darf nur der Sysadmin; den Key selbst erfährt nur der Nutzer, gespeichert wird
 * nur der SHA-256-Hash.
 *
 * - `pending`: angelegt, Key noch nicht erzeugt bzw. abgeholt
 * - `active`: gültig bis `expiresAt`
 * - `revoked`: vom Sysadmin oder Nutzer zurückgezogen
 */
const apiKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Rolle des Nutzers beim Anlegen. Ändert sie sich, ist der Key ungültig. */
    role: { type: String, enum: userRoles, required: true },
    /** Name der externen App, z. B. „Trainings-Tracker“. */
    name: { type: String, required: true, trim: true },
    scopes: { type: [String], enum: apiKeyScopes, required: true },
    status: { type: String, enum: storedApiKeyStatuses, required: true, default: "pending" },
    /** `null`, solange der Key nicht erzeugt wurde. */
    keyHash: { type: String, default: null },
    /** Erste Zeichen des Keys zum Wiedererkennen in Listen, z. B. `apt_Xy3k`. */
    keyPreview: { type: String, default: null },
    /** Requests je 15 Minuten, eigener Bucket pro Key. */
    rateLimit: { type: Number, required: true, default: API_KEY_DEFAULT_RATE_LIMIT },
    createdById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    activatedAt: { type: Date, default: null },
    /** Ein Jahr nach Aktivierung, nicht verlängerbar. */
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Hash des Abhol-Links aus der Mail. Ein neuer Link macht den alten ungültig. */
    pickupTokenHash: { type: String, default: null },
    pickupExpiresAt: { type: Date, default: null },
    /** Wann der Nutzer beim Abholen den Datenzugriff der App bestätigt hat. */
    dataAccessAcceptedAt: { type: Date, default: null },
    /** Gesetzt bei Erneuerung: der Key, den dieser ablöst. Der alte bleibt bis zu seinem Ablauf gültig. */
    renewedFromId: { type: Schema.Types.ObjectId, ref: "ApiKey", default: null, index: true },
    /** Wann der Nutzer per Mail auf den baldigen Ablauf hingewiesen wurde. */
    expiryNoticeSentAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    requestCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

apiKeySchema.index(
  { keyHash: 1 },
  { unique: true, partialFilterExpression: { keyHash: { $type: "string" } } },
);

apiKeySchema.index(
  { pickupTokenHash: 1 },
  { unique: true, partialFilterExpression: { pickupTokenHash: { $type: "string" } } },
);

export type ApiKeyDocument = HydratedDocumentFromSchema<typeof apiKeySchema>;

export const ApiKeyModel = model("ApiKey", apiKeySchema);

/**
 * Schreibzugriff über einen API-Key. Enthält bewusst keine Inhalte, nur was zur Nachvollziehbarkeit
 * nötig ist. MongoDB löscht Einträge nach 90 Tagen.
 */
const apiKeyAuditSchema = new Schema({
  apiKeyId: { type: Schema.Types.ObjectId, ref: "ApiKey", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  status: { type: Number, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
});

export const API_KEY_AUDIT_RETENTION_SECONDS = 90 * 24 * 60 * 60;

apiKeyAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: API_KEY_AUDIT_RETENTION_SECONDS });

export const ApiKeyAuditModel = model("ApiKeyAudit", apiKeyAuditSchema);
