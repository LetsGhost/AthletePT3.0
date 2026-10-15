import {
  exerciseSearchKey,
  type Equipment,
  type ExerciseCategory,
  type MuscleGroup,
} from "@athletept/shared";

import { logger } from "../../lib/logger/logger";
import { ExerciseModel } from "./exercise.model";

interface SeedExercise {
  /** Stabil, nie ändern: daran erkennt das Seed, was schon angelegt ist. */
  key: string;
  name: string;
  aliases: string[];
  category: ExerciseCategory;
  equipment: Equipment;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

const e = (
  key: string,
  name: string,
  aliases: string[],
  category: ExerciseCategory,
  equipment: Equipment,
  primary: MuscleGroup[],
  secondary: MuscleGroup[] = [],
): SeedExercise => ({ key, name, aliases, category, equipment, primary, secondary });

/** Startdaten des globalen Katalogs: gängige Grundübungen. Der Sysadmin kann sie danach pflegen. */
// prettier-ignore
export const seedExercises: SeedExercise[] = [
  // Brust
  e("bench-press", "Bankdrücken", ["Bench Press", "Flachbankdrücken"], "compound", "barbell", ["chest"], ["front_delts", "triceps"]),
  e("dumbbell-bench-press", "Kurzhantel-Bankdrücken", ["Dumbbell Bench Press"], "compound", "dumbbell", ["chest"], ["front_delts", "triceps"]),
  e("incline-dumbbell-press", "Schrägbankdrücken mit Kurzhanteln", ["Incline Dumbbell Press", "Schrägbankdrücken"], "compound", "dumbbell", ["chest", "front_delts"], ["triceps"]),
  e("push-up", "Liegestütze", ["Push-up", "Liegestütz"], "compound", "bodyweight", ["chest"], ["front_delts", "triceps", "abs"]),
  e("dips", "Dips", ["Barrenstütz"], "compound", "bodyweight", ["chest", "triceps"], ["front_delts"]),
  e("cable-fly", "Butterfly am Kabelzug", ["Cable Fly", "Kabelzug-Flys", "Cable Crossover"], "isolation", "cable", ["chest"], ["front_delts"]),
  e("pec-deck", "Butterfly an der Maschine", ["Pec Deck", "Butterfly-Maschine"], "isolation", "machine", ["chest"], ["front_delts"]),
  // Schultern
  e("overhead-press", "Schulterdrücken mit Langhantel", ["Overhead Press", "Military Press", "Schulterdrücken"], "compound", "barbell", ["front_delts"], ["side_delts", "triceps"]),
  e("dumbbell-shoulder-press", "Schulterdrücken mit Kurzhanteln", ["Dumbbell Shoulder Press"], "compound", "dumbbell", ["front_delts"], ["side_delts", "triceps"]),
  e("lateral-raise", "Seitheben", ["Lateral Raise", "Seitheben mit Kurzhanteln"], "isolation", "dumbbell", ["side_delts"], ["traps"]),
  e("reverse-fly", "Reverse Flys", ["Reverse Fly", "Vorgebeugtes Seitheben"], "isolation", "dumbbell", ["rear_delts"], ["upper_back"]),
  e("face-pull", "Face Pulls", ["Face Pull"], "isolation", "cable", ["rear_delts"], ["upper_back", "traps"]),
  // Rücken
  e("pull-up", "Klimmzüge", ["Pull-up", "Klimmzug"], "compound", "bodyweight", ["lats"], ["biceps", "upper_back"]),
  e("lat-pulldown", "Latzug", ["Lat Pulldown", "Latziehen"], "compound", "cable", ["lats"], ["biceps", "upper_back"]),
  e("barbell-row", "Langhantelrudern", ["Barbell Row", "Vorgebeugtes Rudern"], "compound", "barbell", ["upper_back", "lats"], ["rear_delts", "biceps", "lower_back"]),
  e("one-arm-dumbbell-row", "Einarmiges Kurzhantelrudern", ["One-Arm Dumbbell Row", "Kurzhantelrudern"], "compound", "dumbbell", ["lats", "upper_back"], ["rear_delts", "biceps"]),
  e("seated-cable-row", "Rudern am Kabelzug", ["Seated Cable Row", "Kabelrudern sitzend"], "compound", "cable", ["upper_back", "lats"], ["biceps", "rear_delts"]),
  e("shrug", "Shrugs", ["Schulterheben", "Shrug"], "isolation", "dumbbell", ["traps"], ["forearms"]),
  e("back-extension", "Hyperextensions", ["Back Extension", "Rückenstrecker"], "isolation", "bodyweight", ["lower_back"], ["glutes", "hamstrings"]),
  // Beine und Gesäß
  e("deadlift", "Kreuzheben", ["Deadlift"], "compound", "barbell", ["hamstrings", "glutes", "lower_back"], ["quads", "traps", "forearms"]),
  e("romanian-deadlift", "Rumänisches Kreuzheben", ["Romanian Deadlift", "RDL"], "compound", "barbell", ["hamstrings", "glutes"], ["lower_back"]),
  e("back-squat", "Kniebeuge", ["Back Squat", "Squat", "Kniebeugen"], "compound", "barbell", ["quads", "glutes"], ["adductors", "lower_back"]),
  e("front-squat", "Frontkniebeuge", ["Front Squat"], "compound", "barbell", ["quads"], ["glutes", "abs"]),
  e("leg-press", "Beinpresse", ["Leg Press"], "compound", "machine", ["quads", "glutes"], ["adductors"]),
  e("lunge", "Ausfallschritte", ["Lunges", "Ausfallschritt"], "compound", "dumbbell", ["quads", "glutes"], ["adductors", "hamstrings"]),
  e("bulgarian-split-squat", "Bulgarian Split Squat", ["Bulgarische Kniebeuge"], "compound", "dumbbell", ["quads", "glutes"], ["adductors"]),
  e("hip-thrust", "Hip Thrust", ["Hüftstoßen", "Hip Thrusts"], "compound", "barbell", ["glutes"], ["hamstrings"]),
  e("leg-extension", "Beinstrecker", ["Leg Extension"], "isolation", "machine", ["quads"]),
  e("lying-leg-curl", "Beinbeuger liegend", ["Lying Leg Curl", "Leg Curl"], "isolation", "machine", ["hamstrings"], ["calves"]),
  e("standing-calf-raise", "Wadenheben stehend", ["Standing Calf Raise", "Wadenheben"], "isolation", "machine", ["calves"]),
  e("hip-adduction", "Adduktorenmaschine", ["Hip Adduction", "Adduktoren"], "isolation", "machine", ["adductors"]),
  e("hip-abduction", "Abduktorenmaschine", ["Hip Abduction", "Abduktoren"], "isolation", "machine", ["abductors"], ["glutes"]),
  e("kettlebell-swing", "Kettlebell Swing", ["Swing", "KB Swing"], "compound", "kettlebell", ["glutes", "hamstrings"], ["lower_back", "abs"]),
  // Arme
  e("dumbbell-curl", "Bizepscurls mit Kurzhanteln", ["Dumbbell Curl", "Bizepscurls"], "isolation", "dumbbell", ["biceps"], ["forearms"]),
  e("barbell-curl", "Langhantelcurls", ["Barbell Curl"], "isolation", "barbell", ["biceps"], ["forearms"]),
  e("hammer-curl", "Hammercurls", ["Hammer Curl"], "isolation", "dumbbell", ["biceps", "forearms"]),
  e("triceps-pushdown", "Trizepsdrücken am Kabelzug", ["Triceps Pushdown", "Pushdowns"], "isolation", "cable", ["triceps"]),
  e("skull-crusher", "French Press", ["Skull Crusher", "Stirndrücken"], "isolation", "barbell", ["triceps"]),
  // Rumpf
  e("plank", "Plank", ["Unterarmstütz", "Planke"], "isolation", "bodyweight", ["abs"], ["obliques", "lower_back"]),
  e("crunch", "Crunches", ["Crunch", "Bauchpresse"], "isolation", "bodyweight", ["abs"], ["obliques"]),
  e("hanging-leg-raise", "Hängendes Beinheben", ["Hanging Leg Raise"], "isolation", "bodyweight", ["abs"], ["obliques", "forearms"]),
  // Cardio und Mobility
  e("rowing-machine", "Rudergerät", ["Rowing Machine", "Ruderergometer"], "cardio", "machine", ["upper_back", "quads"], ["lats", "hamstrings"]),
  e("stationary-bike", "Fahrradergometer", ["Stationary Bike", "Ergometer", "Radfahren"], "cardio", "machine", ["quads"], ["glutes", "calves"]),
  e("thoracic-rotation", "Thorakale Rotation", ["Thoracic Rotation", "BWS-Rotation"], "mobility", "bodyweight", ["upper_back"], ["obliques"]),
  e("hip-90-90", "Hüftmobilisation 90/90", ["90/90 Hip Switch", "Hüftöffner"], "mobility", "bodyweight", ["glutes"], ["adductors", "abductors"]),
];

/**
 * Legt fehlende Startübungen an. Kann beliebig oft laufen: Was über den `seedKey` oder unter
 * gleichem Namen schon im Katalog steht, bleibt unangetastet (auch wenn der Sysadmin es geändert
 * oder archiviert hat).
 */
export async function seedGlobalExercises() {
  const existing = await ExerciseModel.find(
    { ownerCoachId: null },
    { seedKey: 1, searchKey: 1, archivedAt: 1 },
  ).lean();
  const seedKeys = new Set(existing.map((x) => x.seedKey).filter(Boolean));
  const activeNames = new Set(existing.filter((x) => !x.archivedAt).map((x) => x.searchKey));

  const missing = seedExercises.filter(
    (x) => !seedKeys.has(x.key) && !activeNames.has(exerciseSearchKey(x.name)),
  );
  if (missing.length === 0) return 0;

  try {
    await ExerciseModel.insertMany(
      missing.map((x) => ({
        ownerCoachId: null,
        seedKey: x.key,
        name: x.name,
        searchKey: exerciseSearchKey(x.name),
        aliases: x.aliases,
        aliasKeys: x.aliases.map(exerciseSearchKey),
        category: x.category,
        equipment: x.equipment,
        primaryMuscles: x.primary,
        secondaryMuscles: x.secondary,
      })),
      { ordered: false },
    );
  } catch (error) {
    // Eine zweite Instanz war schneller: doppelte Einträge verhindert der Index, der Rest ist drin.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  logger.info("Übungskatalog mit Startdaten ergänzt", { count: missing.length });
  return missing.length;
}
