import { equipmentTypes, exerciseCategories, muscleGroups, type Exercise } from "@athletept/shared";
import { Schema, model, type HydratedDocumentFromSchema } from "mongoose";

/**
 * Übung im Katalog. `ownerCoachId: null` ist eine globale Übung (vom Sysadmin gepflegt),
 * sonst gehört sie diesem Coach und nur er sieht sie. Übungen werden nie gelöscht, nur
 * archiviert, weil Pläne und Protokolle über die ID auf sie verweisen.
 */
const exerciseSchema = new Schema(
  {
    ownerCoachId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    /** `exerciseSearchKey(name)`, für Eindeutigkeit, Suche und Sortierung. */
    searchKey: { type: String, required: true },
    aliases: { type: [String], default: [] },
    /** Normalisierte Synonyme für die Suche. */
    aliasKeys: { type: [String], default: [] },
    category: { type: String, enum: exerciseCategories, required: true },
    equipment: { type: String, enum: equipmentTypes, required: true },
    primaryMuscles: { type: [String], enum: muscleGroups, required: true },
    secondaryMuscles: { type: [String], enum: muscleGroups, default: [] },
    description: { type: String, default: null },
    executionNotes: { type: String, default: null },
    videoUrl: { type: String, default: null },
    /** Nur bei Startdaten: stabiler Schlüssel, damit das Seed-Skript nichts doppelt anlegt. */
    seedKey: { type: String, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Namen sind pro Katalog eindeutig, archivierte zählen nicht mit.
exerciseSchema.index(
  { ownerCoachId: 1, searchKey: 1 },
  { unique: true, partialFilterExpression: { archivedAt: { $type: "null" } } },
);
exerciseSchema.index(
  { seedKey: 1 },
  { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
);

export type ExerciseDocument = HydratedDocumentFromSchema<typeof exerciseSchema>;

export const ExerciseModel = model("Exercise", exerciseSchema);

type ExerciseLike = Pick<
  ExerciseDocument,
  | "_id"
  | "ownerCoachId"
  | "name"
  | "aliases"
  | "category"
  | "equipment"
  | "primaryMuscles"
  | "secondaryMuscles"
  | "description"
  | "executionNotes"
  | "videoUrl"
  | "archivedAt"
  | "createdAt"
  | "updatedAt"
>;

export function toExerciseDto(exercise: ExerciseLike): Exercise {
  return {
    id: exercise._id.toString(),
    name: exercise.name,
    aliases: [...exercise.aliases],
    category: exercise.category,
    equipment: exercise.equipment,
    primaryMuscles: [...exercise.primaryMuscles] as Exercise["primaryMuscles"],
    secondaryMuscles: [...exercise.secondaryMuscles] as Exercise["secondaryMuscles"],
    description: exercise.description ?? null,
    executionNotes: exercise.executionNotes ?? null,
    videoUrl: exercise.videoUrl ?? null,
    scope: exercise.ownerCoachId ? "own" : "global",
    archived: Boolean(exercise.archivedAt),
    createdAt: exercise.createdAt.toISOString(),
    updatedAt: exercise.updatedAt.toISOString(),
  };
}
