import { describe, expect, it } from "vitest";

import type { EditorSet } from "./editor-values";
import { setNames, summarizeSets } from "./set-summary";

const working = (overrides: Partial<EditorSet> = {}): EditorSet => ({
  kind: "working",
  repsMin: 8,
  repsMax: 10,
  weightKg: 80,
  ...overrides,
});

describe("summarizeSets", () => {
  it("fasst gleiche Arbeitssätze zusammen und nennt Aufwärmsätze", () => {
    const text = summarizeSets([working({ kind: "warmup" }), working(), working(), working()]);
    expect(text).toMatch(/^3 × /);
    expect(text).toMatch(/\+1 Aufwärmen$/);
  });

  it("meldet unterschiedliche Arbeitssätze", () => {
    expect(summarizeSets([working(), working({ weightKg: 90 })])).toBe(
      "2 Arbeitssätze, unterschiedlich",
    );
  });

  it("meldet fehlende Sätze", () => {
    expect(summarizeSets([])).toBe("Noch keine Sätze");
    expect(summarizeSets([working({ kind: "warmup" })])).toBe(
      "Noch keine Arbeitssätze · +1 Aufwärmen",
    );
  });
});

describe("setNames", () => {
  it("zählt Arbeitssätze durch und nummeriert Aufwärmsätze nur, wenn es mehrere gibt", () => {
    expect(setNames([{ kind: "warmup" }, { kind: "working" }, { kind: "working" }])).toEqual([
      { badge: "W", name: "Aufwärmsatz" },
      { badge: "1", name: "Satz 1" },
      { badge: "2", name: "Satz 2" },
    ]);
    expect(setNames([{ kind: "warmup" }, { kind: "warmup" }]).map((x) => x.name)).toEqual([
      "Aufwärmsatz 1",
      "Aufwärmsatz 2",
    ]);
  });
});
