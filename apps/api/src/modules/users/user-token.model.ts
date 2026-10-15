import { Schema, model } from "mongoose";

export const userTokenTypes = ["invitation", "password_reset"] as const;
export type UserTokenType = (typeof userTokenTypes)[number];

/**
 * Einmal-Token für Einladungs- und Passwort-Reset-Links. Gespeichert wird nur der Hash,
 * abgelaufene Tokens löscht MongoDB per TTL-Index.
 */
const userTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: userTokenTypes, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

userTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserTokenModel = model("UserToken", userTokenSchema);
