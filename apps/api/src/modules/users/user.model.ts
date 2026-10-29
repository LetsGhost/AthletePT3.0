import { userRoles, userStatuses, type User } from "@athletept/shared";
import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Nie automatisch mitladen. Wird nur für Login und Passwortwechsel explizit selektiert.
    passwordHash: { type: String, select: false, default: null },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: userRoles, required: true },
    status: { type: String, enum: userStatuses, required: true, default: "invited" },
    /** Nur bei Athleten: zuständiger Coach. */
    coachId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    /** Nur bei Coaches: maximale Anzahl aktiver oder eingeladener Athleten. */
    athleteQuota: { type: Number, default: null },
    /**
     * Wird bei jeder Athleten-Anlage durch diesen Coach in der Transaktion erhöht. Erzwingt einen
     * Schreibkonflikt zwischen parallelen Anlagen, damit das Kontingent nicht überschritten wird.
     */
    quotaLock: { type: Number, default: 0, select: false },
    lastLoginAt: { type: Date, default: null },
    /**
     * Steht in jedem Access-Token. Erhöhen macht alle bisher ausgestellten Access-Tokens sofort
     * ungültig (siehe `revokeAllSessions`).
     */
    tokenVersion: { type: Number, default: 0 },
    /** Nur bei Athleten: was der Coach dem Athleten selbst erlaubt (siehe `getAccessibleAthlete`). */
    athletePermissions: {
      type: new Schema(
        {
          ownPlan: { type: Boolean, default: false },
          ownWeek: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: null,
    },
    /** Nur bei Athleten: Spitzname für globale Ranglisten und Duelle mit anderen Teams. */
    nickname: { type: String, default: null },
    /** Kleingeschrieben, für die Eindeutigkeit ohne Rücksicht auf Groß-/Kleinschreibung. */
    nicknameLower: { type: String, default: null },
    /** Mails zu Challenges (Einladungen, neue Challenges, Ergebnisse). */
    challengeMails: { type: Boolean, default: true },
    /** Nur bei Athleten: Einwilligung in die Verarbeitung von Gesundheitsdaten (Art. 9 DSGVO). */
    healthDataConsent: {
      type: new Schema(
        {
          grantedAt: { type: Date, required: true },
          privacyPolicyVersion: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.index(
  { nicknameLower: 1 },
  { unique: true, partialFilterExpression: { nicknameLower: { $type: "string" } } },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocumentFromSchema<typeof userSchema>;

export const UserModel = model("User", userSchema);

/** Einzige Stelle, an der ein User-Dokument in die öffentliche Form gebracht wird. */
export function toUserDto(user: UserDocument): User {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    coachId: user.coachId ? user.coachId.toString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
