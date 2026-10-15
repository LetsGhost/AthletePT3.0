import {
  planTypes,
  setKinds,
  workoutStatuses,
  type PlanType,
  type SetKind,
  type WorkoutStatus,
} from "@athletept/shared";
import { Schema, model, type Types } from "mongoose";

import type { StoredSet } from "../plans/plan-content.model";

/**
 * Trainingsprotokoll: eine Einheit pro Dokument. Gehört dem Athleten. Vorgaben, Namen und
 * Tagesname sind Kopien aus dem Plan beim Start, damit das Protokoll lesbar bleibt, wenn der Plan
 * später geändert oder archiviert wird.
 */
export interface StoredWorkoutSet {
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  done: boolean;
}

export interface StoredWorkoutExercise {
  _id: Types.ObjectId;
  planExerciseId: Types.ObjectId;
  exerciseId: Types.ObjectId;
  exerciseName: string;
  restSeconds: number | null;
  planNotes: string | null;
  targets: StoredSet[];
  skipped: boolean;
  notes: string | null;
  sets: StoredWorkoutSet[];
}

export interface StoredWorkoutLog {
  _id: Types.ObjectId;
  athleteId: Types.ObjectId;
  planId: Types.ObjectId;
  planRevision: number;
  dayId: Types.ObjectId;
  dayName: string;
  dayType: PlanType;
  date: string;
  status: WorkoutStatus;
  exercises: StoredWorkoutExercise[];
  rating: number | null;
  notes: string | null;
  revision: number;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const nullableNumber = { type: Number, default: null };
const nullableString = { type: String, default: null };

const targetSchema = new Schema(
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

const setSchema = new Schema(
  {
    kind: { type: String, enum: setKinds, required: true },
    weightKg: nullableNumber,
    reps: nullableNumber,
    durationSeconds: nullableNumber,
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const exerciseSchema = new Schema({
  planExerciseId: { type: Schema.Types.ObjectId, required: true },
  exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true },
  exerciseName: { type: String, required: true },
  restSeconds: nullableNumber,
  planNotes: nullableString,
  targets: { type: [targetSchema], default: [] },
  skipped: { type: Boolean, default: false },
  notes: nullableString,
  sets: { type: [setSchema], default: [] },
});

const workoutLogSchema = new Schema(
  {
    athleteId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "TrainingPlan", required: true },
    planRevision: { type: Number, required: true },
    dayId: { type: Schema.Types.ObjectId, required: true },
    dayName: { type: String, required: true },
    dayType: { type: String, enum: planTypes, required: true },
    /** Kalendertag `YYYY-MM-DD` in APP_TIME_ZONE. */
    date: { type: String, required: true },
    status: { type: String, enum: workoutStatuses, required: true },
    exercises: { type: [exerciseSchema], default: [] },
    rating: nullableNumber,
    notes: nullableString,
    revision: { type: Number, required: true, default: 0 },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workoutLogSchema.index({ athleteId: 1, date: -1 });
// Für die spätere Übungsanalyse und „letztes Mal“.
workoutLogSchema.index({ athleteId: 1, "exercises.exerciseId": 1, date: -1 });
workoutLogSchema.index(
  { athleteId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "in_progress" },
    name: "one_workout_in_progress",
  },
);

export const WorkoutLogModel = model("WorkoutLog", workoutLogSchema);

/**
 * Freitexte je Wochentag (z. B. „Laufen“), unabhängig vom Plan. Gepflegt vom Coach, mit der
 * Berechtigung `ownWeek` auch vom Athleten selbst.
 */
const weeklyActivitiesSchema = new Schema(
  {
    athleteId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    activities: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const WeeklyActivitiesModel = model("WeeklyActivities", weeklyActivitiesSchema);
