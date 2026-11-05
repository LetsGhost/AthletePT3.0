import {
  systemMetrics,
  systemRhythms,
  systemTemplateStatuses,
  type SystemMetric,
  type SystemRhythm,
  type SystemTemplateStatus,
} from "@athletept/shared";
import { Schema, model, type Types } from "mongoose";

/**
 * Vorlage einer System-Challenge. Aus aktiven Vorlagen legt der Challenge-Job die Runden an
 * (Challenges mit `kind: "system"` und `templateId`).
 */
export interface StoredSystemTemplate {
  _id: Types.ObjectId;
  title: string;
  description: string | null;
  metric: SystemMetric;
  /** Bronze, Silber, Gold. */
  tiers: number[];
  rhythm: SystemRhythm;
  /** Nur bei `once`. */
  startDate: string | null;
  endDate: string | null;
  status: SystemTemplateStatus;
  createdAt: Date;
  updatedAt: Date;
}

const systemTemplateSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: null },
    metric: { type: String, enum: systemMetrics, required: true },
    tiers: { type: [Number], required: true },
    rhythm: { type: String, enum: systemRhythms, required: true },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    status: { type: String, enum: systemTemplateStatuses, required: true },
  },
  { timestamps: true },
);

export const SystemTemplateModel = model("SystemTemplate", systemTemplateSchema);
