import { exerciseCategoryLabels, type MuscleGroup } from "@athletept/shared";

import type { ExerciseInfo } from "./editor-values";

/** Grobe Muskelgruppen für die Übersicht im Plan-Editor (Tag an der Übung, Volumen pro Woche). */
export const coarseGroups = ["Brust", "Rücken", "Schultern", "Arme", "Beine", "Core"] as const;
export type CoarseGroup = (typeof coarseGroups)[number];

const coarseGroupOf: Record<MuscleGroup, CoarseGroup> = {
  chest: "Brust",
  lats: "Rücken",
  upper_back: "Rücken",
  traps: "Rücken",
  lower_back: "Rücken",
  front_delts: "Schultern",
  side_delts: "Schultern",
  rear_delts: "Schultern",
  biceps: "Arme",
  triceps: "Arme",
  forearms: "Arme",
  glutes: "Beine",
  quads: "Beine",
  hamstrings: "Beine",
  adductors: "Beine",
  abductors: "Beine",
  calves: "Beine",
  abs: "Core",
  obliques: "Core",
};

/** Grobe Gruppen der primären Muskeln, jede nur einmal. */
export function coarseGroupsOf(info: Pick<ExerciseInfo, "primaryMuscles">): CoarseGroup[] {
  return [...new Set(info.primaryMuscles.map((muscle) => coarseGroupOf[muscle]))];
}

/** Kurzes Etikett für eine Übung: grobe Gruppe des ersten primären Muskels, sonst die Kategorie. */
export function exerciseTag(info: ExerciseInfo | undefined): string | null {
  if (!info) return null;
  const first = info.primaryMuscles[0];
  return first ? coarseGroupOf[first] : exerciseCategoryLabels[info.category];
}

/**
 * Arbeitssätze pro grober Gruppe. Jede Übung zählt ihre Arbeitssätze voll für jede Gruppe ihrer
 * primären Muskeln (Kreuzheben: Beine und Rücken).
 */
export function workingSetsPerGroup(
  entries: readonly { info: ExerciseInfo | undefined; workingSets: number }[],
): Record<CoarseGroup, number> {
  const volume = Object.fromEntries(coarseGroups.map((group) => [group, 0])) as Record<
    CoarseGroup,
    number
  >;
  for (const { info, workingSets } of entries) {
    if (!info) continue;
    for (const group of coarseGroupsOf(info)) volume[group] += workingSets;
  }
  return volume;
}
