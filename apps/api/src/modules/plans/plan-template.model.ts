import { Schema, model, type Types } from "mongoose";

import { writeSourceField, type StoredWriteSource } from "../api-keys/write-source";
import { contentFields, type StoredContent } from "./plan-content.model";

/** Planvorlage eines Coaches, ohne Athlet. Nur der Coach selbst sieht sie. */
const planTemplateSchema = new Schema(
  {
    ownerCoachId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ...contentFields,
    ...writeSourceField,
  },
  { timestamps: true },
);

export interface StoredPlanTemplate extends StoredContent {
  _id: Types.ObjectId;
  ownerCoachId: Types.ObjectId;
  lastWriteVia?: StoredWriteSource | null;
  createdAt: Date;
  updatedAt: Date;
}

export const PlanTemplateModel = model("PlanTemplate", planTemplateSchema);
