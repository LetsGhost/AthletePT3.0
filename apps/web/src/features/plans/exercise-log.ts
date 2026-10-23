import type { ExerciseLogEntry, PlanSet, WorkoutSet } from "@athletept/shared";

export interface LoggedSet {
  set: WorkoutSet;
  /** Nicht erledigt oder unter der Vorgabe (Wiederholungen, Dauer oder Gewicht). */
  below: boolean;
}

function isBelow(set: WorkoutSet, target: PlanSet | undefined) {
  if (!set.done) return true;
  if (!target) return false;
  if (target.repsMin !== null && (set.reps ?? 0) < target.repsMin) return true;
  if (target.durationSeconds !== null && (set.durationSeconds ?? 0) < target.durationSeconds) {
    return true;
  }
  return target.weightKg !== null && (set.weightKg ?? 0) < target.weightKg;
}

/** Arbeitssätze einer Einheit mit Bewertung gegen die Vorgabe beim Start (Satz i ↔ Vorgabe i). */
export function workingSets(entry: ExerciseLogEntry): LoggedSet[] {
  return entry.sets.flatMap((set, i) =>
    set.kind === "working" ? [{ set, below: isBelow(set, entry.targets[i]) }] : [],
  );
}

/** Höchstes Gewicht der erledigten Arbeitssätze, `null` ohne Gewicht. */
export function bestWeight(entry: ExerciseLogEntry) {
  const weights = entry.sets.flatMap((s) =>
    s.kind === "working" && s.done && s.weightKg !== null ? [s.weightKg] : [],
  );
  return weights.length > 0 ? Math.max(...weights) : null;
}

/** Geplante RIR der Arbeitssätze (die erste angegebene), `null` ohne Angabe. */
export function plannedRir(entry: ExerciseLogEntry) {
  return entry.targets.find((t) => t.kind === "working" && t.rir !== null)?.rir ?? null;
}
