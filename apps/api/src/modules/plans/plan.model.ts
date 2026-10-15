import { planStatuses, type PlanStatus } from "@athletept/shared";
import { Schema, model, type Types } from "mongoose";

import { contentFields, type StoredContent } from "./plan-content.model";

/**
 * Trainingsplan eines Athleten. Gehört dem Athleten, nicht dem Coach: Wechselt der Athlet den
 * Coach, sieht der neue Coach die Pläne. Pro Athlet ist höchstens ein Plan aktiv.
 */
const trainingPlanSchema = new Schema(
  {
    athleteId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /**
     * Nur zur Nachvollziehbarkeit, daraus folgen keine Rechte. `null`: vom Athleten selbst
     * angelegt (Berechtigung `ownPlan`).
     */
    createdByCoachId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: planStatuses, required: true, default: "draft" },
    ...contentFields,
    activatedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

trainingPlanSchema.index({ athleteId: 1, status: 1 });
trainingPlanSchema.index(
  { athleteId: 1 },
  { unique: true, partialFilterExpression: { status: "active" }, name: "one_active_plan" },
);

export interface StoredPlan extends StoredContent {
  _id: Types.ObjectId;
  athleteId: Types.ObjectId;
  createdByCoachId: Types.ObjectId | null;
  status: PlanStatus;
  activatedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const TrainingPlanModel = model("TrainingPlan", trainingPlanSchema);

/**
 * Früherer Stand eines aktiven Plans. Wird vor jeder Änderung gesichert, damit nachvollziehbar
 * bleibt, was der Athlet wann vorgegeben bekam.
 */
const trainingPlanVersionSchema = new Schema({
  planId: { type: Schema.Types.ObjectId, ref: "TrainingPlan", required: true },
  athleteId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  ...contentFields,
  replacedAt: { type: Date, required: true },
  /** `null`: vom Athleten selbst geändert. */
  replacedByCoachId: { type: Schema.Types.ObjectId, ref: "User", default: null },
});

trainingPlanVersionSchema.index({ planId: 1, revision: -1 }, { unique: true });

export interface StoredPlanVersion extends StoredContent {
  _id: Types.ObjectId;
  planId: Types.ObjectId;
  replacedAt: Date;
}

export const TrainingPlanVersionModel = model("TrainingPlanVersion", trainingPlanVersionSchema);
