import {
  bodyRegionLabels,
  bodyRegions,
  muscleGroupInfo,
  muscleGroups,
  type Exercise,
  type MuscleGroup,
  type UserRole,
} from "@athletept/shared";

export function muscleLabel(muscle: MuscleGroup) {
  return muscleGroupInfo[muscle].label;
}

export function muscleList(muscles: readonly MuscleGroup[]) {
  return muscles.map(muscleLabel).join(", ");
}

/** „Brust · auch Trizeps, Vordere Schulter“ */
export function muscleSummary(exercise: Pick<Exercise, "primaryMuscles" | "secondaryMuscles">) {
  const primary = muscleList(exercise.primaryMuscles);
  return exercise.secondaryMuscles.length > 0
    ? `${primary} · auch ${muscleList(exercise.secondaryMuscles)}`
    : primary;
}

/** Muskelgruppen nach Körperregion, in der Reihenfolge der festen Liste. */
export const muscleGroupsByRegion = bodyRegions.map((region) => ({
  label: bodyRegionLabels[region],
  options: muscleGroups
    .filter((muscle) => muscleGroupInfo[muscle].region === region)
    .map((muscle) => ({ value: muscle, label: muscleLabel(muscle) })),
}));

/**
 * Kennzeichnung der Herkunft, globale Übungen bleiben ohne. `own` ist beim Athleten der Katalog
 * seines Coaches.
 */
export function scopeLabel(scope: Exercise["scope"], role: UserRole | undefined) {
  if (scope === "private") return "Privat";
  if (scope === "own") return role === "athlete" ? "Vom Coach" : "Eigene";
  return null;
}
