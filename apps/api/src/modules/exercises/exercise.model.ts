import { equipmentTypes, exerciseCategories, muscleGroups, type Exercise } from "@athletept/shared";
import { Schema, model, type HydratedDocumentFromSchema } from "mongoose";

/**
 * Übung im Katalog. Ohne Besitzer ist sie global (vom Sysadmin gepflegt). Mit `ownerCoachId`
 * gehört sie diesem Coach (er und seine Athleten sehen sie), mit `ownerAthleteId` ist sie die
 * private Übung eines Athleten (nur er sieht sie, sein Coach kann sie übernehmen). Höchstens
 * eines der beiden Felder ist gesetzt. Übernehmen wechselt nur den Besitzer, die ID bleibt, damit
 * Pläne, Protokolle und Statistik weiter stimmen. Übungen werden nie gelöscht, nur archiviert.
 */
const exerciseSchema = new Schema(
  {
    ownerCoachId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    ownerAthleteId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
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
    /** Coach-Übung, die der Coach für den globalen Katalog vorgeschlagen hat. */
    submittedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Namen sind pro Katalog eindeutig, archivierte zählen nicht mit.
exerciseSchema.index(
  { ownerCoachId: 1, ownerAthleteId: 1, searchKey: 1 },
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
  | "ownerAthleteId"
  | "submittedAt"
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
    scope: exercise.ownerAthleteId ? "private" : exercise.ownerCoachId ? "own" : "global",
    submitted: Boolean(exercise.submittedAt),
    archived: Boolean(exercise.archivedAt),
    createdAt: exercise.createdAt.toISOString(),
    updatedAt: exercise.updatedAt.toISOString(),
  };
}
