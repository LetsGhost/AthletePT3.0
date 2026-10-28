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
  /** Duell: Herausforderer. */
  createdById: Types.ObjectId | null;
  /** Duell: Einladung. Bis zur Annahme ist nur der Herausforderer Teilnehmer. */
  invite: StoredDuelInvite | null;
  /** Duell: Revanche für dieses Duell. Der Gegner ist dann von Anfang an bekannt. */
  rematchOfId: Types.ObjectId | null;
  /** Duell: Laufzeit ab Annahme. */
  durationDays: number | null;
  /** Duell: wer aufgegeben hat (dann auch `endedEarly`). */
  gaveUpById: Types.ObjectId | null;
  /** Ergebnis an die Teilnehmer gemeldet (siehe Challenge-Job). */
  resultNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const duelInviteStatuses = ["pending", "accepted", "declined", "expired"] as const;

export interface StoredDuelInvite {
  /** `null`, wenn zur Adresse kein Athlet gehört: Die Einladung verfällt dann einfach. */
  athleteId: Types.ObjectId | null;
  email: string;
  status: (typeof duelInviteStatuses)[number];
  expiresAt: Date;
  respondedAt: Date | null;
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
    createdById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    invite: {
      type: new Schema(
        {
          athleteId: { type: Schema.Types.ObjectId, ref: "User", default: null },
          email: { type: String, required: true },
          status: { type: String, enum: duelInviteStatuses, required: true },
          expiresAt: { type: Date, required: true },
          respondedAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    rematchOfId: { type: Schema.Types.ObjectId, ref: "Challenge", default: null },
    durationDays: nullableNumber,
    gaveUpById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resultNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

challengeSchema.index({ coachId: 1, endDate: -1 });
challengeSchema.index({ "invite.athleteId": 1, "invite.status": 1 });
challengeSchema.index({ createdById: 1, kind: 1 });
challengeSchema.index({ resultNotifiedAt: 1, endDate: 1 });
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
