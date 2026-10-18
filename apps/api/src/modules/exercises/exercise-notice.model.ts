import { exerciseNoticeKinds, type ExerciseNotice } from "@athletept/shared";
import { Schema, model, type HydratedDocumentFromSchema } from "mongoose";

/**
 * Hinweis an den bisherigen Besitzer, dass seine Übung übernommen wurde. Bleibt, bis er ihn
 * wegklickt. Der Name ist eine Kopie, damit der Hinweis auch nach Umbenennen verständlich bleibt.
 */
const exerciseNoticeSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: exerciseNoticeKinds, required: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true },
    exerciseName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type ExerciseNoticeDocument = HydratedDocumentFromSchema<typeof exerciseNoticeSchema>;

export const ExerciseNoticeModel = model("ExerciseNotice", exerciseNoticeSchema);

export function toExerciseNoticeDto(notice: ExerciseNoticeDocument): ExerciseNotice {
  return {
    id: notice._id.toString(),
    kind: notice.kind,
    exerciseId: notice.exerciseId.toString(),
    exerciseName: notice.exerciseName,
    createdAt: notice.createdAt.toISOString(),
  };
}
