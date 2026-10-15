import type { PlanSet } from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { formatRest, formatSetGroup, groupSets, parseSetShorthand } from "./format";

const set = (overrides: Partial<PlanSet> = {}): PlanSet => ({
  kind: "working",
  repsMin: 8,
  repsMax: 8,
  durationSeconds: null,
  weightKg: null,
  rir: null,
  ...overrides,
});

describe("groupSets", () => {
  it("fasst gleiche Sätze zusammen und trennt Aufwärmsätze", () => {
    const groups = groupSets([
      set({ kind: "warmup", repsMin: 10, repsMax: 10, weightKg: 40 }),
      set({ repsMin: 6, repsMax: 8, weightKg: 82.5, rir: 2 }),
      set({ repsMin: 6, repsMax: 8, weightKg: 82.5, rir: 2 }),
      set({ repsMin: null, repsMax: null, durationSeconds: 45 }),
    ]);

    expect(groups.map((g) => [g.kind, formatSetGroup(g)])).toEqual([
      ["warmup", "1 × 10 Wdh. · 40 kg"],
      ["working", "2 × 6–8 Wdh. · 82,5 kg · RIR 2"],
      ["working", "1 × 45 s"],
    ]);
  });
});

describe("formatRest", () => {
  it("zeigt Sekunden oder volle Minuten", () => {
    expect(formatRest(90)).toBe("90 s Pause");
    expect(formatRest(120)).toBe("2 min Pause");
    expect(formatRest(null)).toBeNull();
  });
});

describe("parseSetShorthand", () => {
  it("versteht Anzahl, Bereich, Gewicht und RIR", () => {
    expect(parseSetShorthand("3 × 8–10 @ 80,5 kg RIR 2")).toEqual(
      Array.from({ length: 3 }, () => ({
        kind: "working",
        repsMin: 8,
        repsMax: 10,
        durationSeconds: null,
        weightKg: 80.5,
        rir: 2,
      })),
    );
    expect(parseSetShorthand("4x5")?.[0]).toMatchObject({ repsMin: 5, repsMax: 5, weightKg: null });
    expect(parseSetShorthand("3x45s")?.[0]).toMatchObject({ repsMin: null, durationSeconds: 45 });
  });

  it("lehnt unklare Eingaben ab", () => {
    for (const input of ["", "acht", "3x", "0x8", "11x8", "3x10-8", "3x8 @"]) {
      expect(parseSetShorthand(input)).toBeNull();
    }
  });
});
