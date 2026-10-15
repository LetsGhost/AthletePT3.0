import { Schema, model, type HydratedDocumentFromSchema } from "mongoose";

/**
 * Eine Login-Sitzung bzw. ein Refresh-Token. Gespeichert wird nur der SHA-256-Hash des Tokens.
 *
 * Bei jedem Refresh entsteht eine neue Session in derselben `familyId`, die alte wird widerrufen
 * (Rotation). Wird ein bereits widerrufenes Token erneut benutzt, gilt die Familie als
 * kompromittiert und wird komplett widerrufen.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    /** Gesetzt, wenn die Session durch Rotation ersetzt (nicht durch Logout beendet) wurde. */
    rotatedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

// MongoDB löscht abgelaufene Sessions automatisch.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDocument = HydratedDocumentFromSchema<typeof sessionSchema>;

export const SessionModel = model("Session", sessionSchema);
