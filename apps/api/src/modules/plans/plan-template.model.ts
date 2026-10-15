import { Schema, model, type Types } from "mongoose";

import { contentFields, type StoredContent } from "./plan-content.model";

/** Planvorlage eines Coaches, ohne Athlet. Nur der Coach selbst sieht sie. */
const planTemplateSchema = new Schema(
  {
    ownerCoachId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ...contentFields,
  },
  { timestamps: true },
);

export interface StoredPlanTemplate extends StoredContent {
  _id: Types.ObjectId;
  ownerCoachId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const PlanTemplateModel = model("PlanTemplate", planTemplateSchema);
