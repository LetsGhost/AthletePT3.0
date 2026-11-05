import type { ExerciseLogEntry, PlanSet, WorkoutSet } from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { bestWeight, plannedRir, workingSets } from "./exercise-log";

const target = (overrides: Partial<PlanSet> = {}): PlanSet => ({
  kind: "working",
  repsMin: 6,
  repsMax: 8,
  durationSeconds: null,
  weightKg: 80,
  rir: 2,
  ...overrides,
});
const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  kind: "working",
  weightKg: 80,
  reps: 8,
  durationSeconds: null,
  done: true,
  ...overrides,
});
const entry = (sets: WorkoutSet[], targets: PlanSet[]): ExerciseLogEntry => ({
  logId: "a".repeat(24),
  date: "2026-10-15",
  sets,
  targets,
  deviating: false,
  notes: null,
});

describe("Protokoll einer Übung", () => {
  it("markiert Arbeitssätze unter der Vorgabe und lässt Aufwärmsätze weg", () => {
    const logged = workingSets(
      entry(
        [
          set({ kind: "warmup", weightKg: 40, reps: 10 }),
          set(),
          set({ reps: 5 }),
          set({ weightKg: 77.5 }),
          set({ done: false }),
          set({ reps: 3 }),
        ],
        [target({ kind: "warmup", rir: null }), target(), target(), target(), target()],
      ),
    );
    // Der letzte Satz hat keine Vorgabe (zusätzlich gemacht) und zählt daher nicht als darunter.
    expect(logged.map((l) => l.below)).toEqual([false, true, true, true, false]);
  });

  it("bewertet Dauer-Sätze nach der Dauer", () => {
    const timed = target({ repsMin: null, repsMax: null, durationSeconds: 45, weightKg: null });
    const logged = workingSets(
      entry(
        [set({ reps: null, weightKg: null, durationSeconds: 40 }), set({ durationSeconds: 45 })],
        [timed, timed],
      ),
    );
    expect(logged.map((l) => l.below)).toEqual([true, false]);
  });

  it("nimmt das höchste erledigte Arbeitsgewicht und die geplante RIR", () => {
    const e = entry(
      [set({ kind: "warmup", weightKg: 100 }), set({ weightKg: 82.5, done: false }), set()],
      [target({ kind: "warmup", rir: null }), target({ rir: null }), target({ rir: 1 })],
    );
    expect(bestWeight(e)).toBe(80);
    expect(plannedRir(e)).toBe(1);
    expect(bestWeight(entry([set({ weightKg: null })], []))).toBeNull();
  });
});
