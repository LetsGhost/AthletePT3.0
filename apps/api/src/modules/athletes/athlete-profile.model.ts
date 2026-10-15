import { sexes, type AthleteProfile } from "@athletept/shared";
import { Schema, model, type HydratedDocumentFromSchema } from "mongoose";

/**
 * Anamnese, getrennt vom User gespeichert: Gesundheitsdaten werden nur geladen,
 * wenn sie gebraucht werden, und lassen sich gezielt löschen.
 */
const athleteProfileSchema = new Schema(
  {
    athleteId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    birthDate: String,
    sex: { type: String, enum: sexes },
    heightCm: Number,
    goal: String,
    focus: String,
    trainingsPerWeek: Number,
    trainingLocation: String,
    trainingTimes: String,
    otherSports: String,
    cardio: String,
    physicalIssues: String,
    conditions: String,
    coachNotes: String,
  },
  { timestamps: true },
);

export type AthleteProfileDocument = HydratedDocumentFromSchema<typeof athleteProfileSchema>;

export const AthleteProfileModel = model("AthleteProfile", athleteProfileSchema);

const profileKeys = [
  "birthDate",
  "sex",
  "heightCm",
  "goal",
  "focus",
  "trainingsPerWeek",
  "trainingLocation",
  "trainingTimes",
  "otherSports",
  "cardio",
  "physicalIssues",
  "conditions",
  "coachNotes",
] as const satisfies readonly (keyof AthleteProfile)[];

/** Nur gesetzte Felder übernehmen, interne Felder (_id, Zeitstempel) weglassen. */
export function toProfileDto(profile: AthleteProfileDocument | null): AthleteProfile {
  const result: Record<string, unknown> = {};
  if (!profile) return result;
  for (const key of profileKeys) {
    const value = profile.get(key) as unknown;
    if (value !== undefined && value !== null && value !== "") result[key] = value;
  }
  return result as AthleteProfile;
}
