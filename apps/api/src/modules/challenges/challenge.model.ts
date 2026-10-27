import {
  challengeKinds,
  challengeMetrics,
  challengeScorings,
  manualModes,
  type ChallengeKind,
  type ChallengeMetric,
  type ChallengeScoring,
  type ManualMode,
} from "@athletept/shared";
import { Schema, model, type Types } from "mongoose";

/**
 * Challenge mit fester Teilnehmerliste. Der Stand wird bei jedem Abruf aus den Trainings bzw.
 * den Einträgen berechnet, gespeichert ist nur die Definition.
 */
export interface StoredChallenge {
  _id: Types.ObjectId;
  kind: ChallengeKind;
  /** Coach, dem die Challenge gehört (nur `coach`). */
  coachId: Types.ObjectId | null;
  title: string;
  description: string | null;
  metric: ChallengeMetric;
  exerciseId: Types.ObjectId | null;
  /** Kopie beim Anlegen, damit der Name auch nach Änderungen am Katalog lesbar bleibt. */
  exerciseName: string | null;
  manualMode: ManualMode | null;
  dailyTarget: number | null;
  scoring: ChallengeScoring;
  goalValue: number | null;
  /** Kalendertage `YYYY-MM-DD` in APP_TIME_ZONE, beide eingeschlossen. */
  startDate: string;
  endDate: string;
  /** Vom Coach vorzeitig beendet, `endDate` ist dann der Tag des Abbruchs. */
  endedEarly: boolean;
  participantIds: Types.ObjectId[];
  prize: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const nullableString = { type: String, default: null };
const nullableNumber = { type: Number, default: null };

const challengeSchema = new Schema(
  {
    kind: { type: String, enum: challengeKinds, required: true },
    coachId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    title: { type: String, required: true },
    description: nullableString,
    metric: { type: String, enum: challengeMetrics, required: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", default: null },
    exerciseName: nullableString,
    manualMode: { type: String, enum: manualModes, default: null },
    dailyTarget: nullableNumber,
    scoring: { type: String, enum: challengeScorings, required: true },
    goalValue: nullableNumber,
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    endedEarly: { type: Boolean, default: false },
    participantIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    prize: nullableString,
  },
  { timestamps: true },
);

challengeSchema.index({ coachId: 1, endDate: -1 });
challengeSchema.index({ participantIds: 1, endDate: -1 });

export const ChallengeModel = model("Challenge", challengeSchema);

/** Tageswert eines Athleten bei einer freien Vorgabe. Abhaken speichert 1 oder 0. */
export interface StoredChallengeEntry {
  _id: Types.ObjectId;
  challengeId: Types.ObjectId;
  athleteId: Types.ObjectId;
  date: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const challengeEntrySchema = new Schema(
  {
    challengeId: { type: Schema.Types.ObjectId, ref: "Challenge", required: true },
    athleteId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { timestamps: true },
);

challengeEntrySchema.index({ challengeId: 1, athleteId: 1, date: 1 }, { unique: true });

export const ChallengeEntryModel = model("ChallengeEntry", challengeEntrySchema);
