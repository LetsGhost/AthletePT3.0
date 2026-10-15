import { planTypes, setKinds, type PlanType, type SetKind } from "@athletept/shared";
import { Schema, type Types } from "mongoose";

/**
 * Gespeicherter Inhalt eines Plans, einer früheren Version oder einer Vorlage. Tage, Übungen und
 * Warm-up-Einträge haben stabile IDs, auf die spätere Protokolle verweisen.
 */
export interface StoredSet {
  kind: SetKind;
  repsMin: number | null;
  repsMax: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
  rir: number | null;
}

export interface StoredPlanExercise {
  _id: Types.ObjectId;
  exerciseId: Types.ObjectId;
  exerciseName: string;
  restSeconds: number | null;
  notes: string | null;
  sets: StoredSet[];
}

export interface StoredWarmupItem {
  _id: Types.ObjectId;
  exerciseId: Types.ObjectId | null;
  name: string;
  details: string | null;
}

export interface StoredDay {
  _id: Types.ObjectId;
  name: string;
  weekday: number | null;
  type: PlanType;
  warmup: StoredWarmupItem[];
  exercises: StoredPlanExercise[];
}

export interface StoredContent {
  name: string;
  notes: string | null;
  type: PlanType;
  revision: number;
  days: StoredDay[];
}

const nullableNumber = { type: Number, default: null };
const nullableString = { type: String, default: null };

const setSchema = new Schema(
  {
    kind: { type: String, enum: setKinds, required: true },
    repsMin: nullableNumber,
    repsMax: nullableNumber,
    durationSeconds: nullableNumber,
    weightKg: nullableNumber,
    rir: nullableNumber,
  },
  { _id: false },
);

const planExerciseSchema = new Schema({
  exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true },
  exerciseName: { type: String, required: true },
  restSeconds: nullableNumber,
  notes: nullableString,
  sets: { type: [setSchema], default: [] },
});

const warmupItemSchema = new Schema({
  exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", default: null },
  name: { type: String, required: true },
  details: nullableString,
});

const daySchema = new Schema({
  name: { type: String, required: true },
  weekday: nullableNumber,
  type: { type: String, enum: planTypes, required: true },
  warmup: { type: [warmupItemSchema], default: [] },
  exercises: { type: [planExerciseSchema], default: [] },
});

/** Felder, die Plan, Version und Vorlage gemeinsam haben. */
export const contentFields = {
  name: { type: String, required: true },
  notes: nullableString,
  type: { type: String, enum: planTypes, required: true },
  revision: { type: Number, required: true, default: 0 },
  days: { type: [daySchema], default: [] },
};
