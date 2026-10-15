import { describe, expect, it } from "vitest";

import { estimateOneRepMax, primaryMetric, sessionMetrics, type StatsSetInput } from "./stats";

const set = (overrides: Partial<StatsSetInput>): StatsSetInput => ({
  kind: "working",
  weightKg: null,
  reps: null,
  durationSeconds: null,
  done: true,
  ...overrides,
});

describe("estimateOneRepMax", () => {
  it("schätzt nach Epley und nur bis 12 Wiederholungen", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    expect(estimateOneRepMax(80, 12)).toBe(112);
    expect(estimateOneRepMax(80, 13)).toBeNull();
    expect(estimateOneRepMax(null, 8)).toBeNull();
    expect(estimateOneRepMax(0, 8)).toBeNull();
  });
});

describe("sessionMetrics", () => {
  it("zählt nur erledigte Arbeitssätze", () => {
    const metrics = sessionMetrics([
      set({ kind: "warmup", weightKg: 120, reps: 1 }),
      set({ weightKg: 95, reps: 8 }),
      set({ weightKg: 100, reps: 3 }),
      set({ weightKg: 110, reps: 5, done: false }),
    ]);
    expect(metrics).toEqual({
      topWeightKg: 100,
      // 95 × 8 (120,3) schlägt 100 × 3 (110).
      estimated1rm: 120.3,
      volumeKg: 1060,
      maxReps: 8,
      maxDurationSeconds: null,
      setCount: 2,
    });
  });

  it("liefert ohne Gewicht Wiederholungen bzw. Dauer", () => {
    const pullUps = sessionMetrics([set({ reps: 8 }), set({ reps: 10 })]);
    expect(pullUps).toMatchObject({ estimated1rm: null, volumeKg: null, maxReps: 10 });
    expect(primaryMetric([pullUps])).toBe("maxReps");

    const plank = sessionMetrics([set({ durationSeconds: 45 }), set({ durationSeconds: 60 })]);
    expect(plank.maxDurationSeconds).toBe(60);
    expect(primaryMetric([plank])).toBe("maxDurationSeconds");

    const bench = sessionMetrics([set({ weightKg: 80, reps: 8 })]);
    expect(primaryMetric([pullUps, bench])).toBe("estimated1rm");

    // Nur mehr als 12 Wdh.: kein geschätztes Maximum, aber Gewicht.
    const lateralRaise = sessionMetrics([set({ weightKg: 10, reps: 15 })]);
    expect(lateralRaise.estimated1rm).toBeNull();
    expect(primaryMetric([lateralRaise])).toBe("topWeightKg");
  });
});
