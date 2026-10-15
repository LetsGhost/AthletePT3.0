import { describe, expect, it } from "vitest";

import { buildWorkoutLog } from "@/test/server";

import { appendSet, draftFromLog, draftToRequest, openSetCount } from "./draft";
import {
  formatClock,
  formatPerformed,
  formatWeek,
  formatWorkoutDuration,
  parseDecimal,
} from "./format";

describe("Formatierung", () => {
  it("zeigt Stoppuhr und Trainingsdauer", () => {
    expect(formatClock(105)).toBe("1:45");
    expect(formatClock(3729)).toBe("1:02:09");
    expect(formatClock(-3)).toBe("0:00");
    expect(formatWorkoutDuration(48 * 60 + 20)).toBe("48 min");
    expect(formatWorkoutDuration(65 * 60)).toBe("1 h 05 min");
  });

  it("beschreibt geschaffte Sätze", () => {
    expect(formatPerformed({ weightKg: 82.5, reps: 8, durationSeconds: null })).toBe("82,5 kg × 8");
    expect(formatPerformed({ weightKg: null, reps: 12, durationSeconds: null })).toBe("12 Wdh.");
    expect(formatPerformed({ weightKg: null, reps: null, durationSeconds: 45 })).toBe("45 s");
    expect(formatPerformed({ weightKg: 20, reps: null, durationSeconds: 60 })).toBe(
      "20 kg · 1 min",
    );
  });

  it("liest Dezimalzahlen mit Komma", () => {
    expect(parseDecimal("82,5")).toBe(82.5);
    expect(parseDecimal(" ")).toBeNull();
    expect(parseDecimal("abc")).toBeNaN();
  });

  it("zeigt die Kalenderwoche", () => {
    expect(formatWeek("2026-W42", "2026-10-12")).toBe("KW 42 · 12. Okt. – 18. Okt.");
  });
});

describe("Entwurf", () => {
  it("wandelt Text in Zahlen und meldet ungültige Felder", () => {
    const draft = draftFromLog(buildWorkoutLog());
    draft.exercises[0]!.sets[0] = { weight: "40,5", reps: "8.5", duration: "", done: true };
    const { body, errors } = draftToRequest(draft, 2);
    expect(body.revision).toBe(2);
    expect(body.exercises[0]!.sets[0]).toEqual({
      weightKg: 40.5,
      reps: null,
      durationSeconds: null,
      done: true,
    });
    expect(errors).toEqual({ "0.0.reps": "Ganze Zahl" });
  });

  it("übernimmt beim neuen Satz die Werte des letzten und zählt offene Sätze", () => {
    const draft = draftFromLog(buildWorkoutLog());
    const exercise = appendSet(draft.exercises[0]!);
    expect(exercise.sets).toHaveLength(5);
    expect(exercise.sets[4]).toEqual({ ...exercise.sets[3], done: false });
    expect(openSetCount(draft)).toBe(4);
    expect(openSetCount({ ...draft, exercises: [{ ...draft.exercises[0]!, skipped: true }] })).toBe(
      0,
    );
  });
});
