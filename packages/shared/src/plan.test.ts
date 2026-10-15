import { describe, expect, it } from "vitest";

import type { MuscleGroup } from "./exercise";
import { detectPlanType, planContentSchema, planSetSchema, type PlanTypeInput } from "./plan";

const strength = (...primaryMuscles: MuscleGroup[]): PlanTypeInput => ({
  category: "compound",
  primaryMuscles,
});

describe("detectPlanType", () => {
  it("erkennt Beine, Unter-, Oberkörper und Ganzkörper über die Regionen", () => {
    expect(detectPlanType([strength("quads"), strength("hamstrings"), strength("calves")])).toBe(
      "LEGS",
    );
    expect(detectPlanType([strength("quads"), strength("glutes"), strength("abs")])).toBe("LOWER");
    expect(detectPlanType([strength("chest"), strength("lats"), strength("biceps")])).toBe("UPPER");
    expect(detectPlanType([strength("chest"), strength("quads"), strength("abs")])).toBe(
      "FULLBODY",
    );
  });

  it("verteilt eine Übung anteilig auf ihre primären Muskelgruppen", () => {
    // Kreuzheben: ⅔ Unterkörper, ⅓ Rumpf. Mit drei Oberkörperübungen: ⅔ von 3⅔ < 25 %.
    const deadlift = strength("hamstrings", "glutes", "lower_back");
    expect(
      detectPlanType([deadlift, strength("chest"), strength("lats"), strength("front_delts")]),
    ).toBe("UPPER");
    // Drei Mal Kreuzheben und eine Kniebeuge: (2 + 1) / 4 = 75 % Unterkörper.
    expect(detectPlanType([deadlift, deadlift, deadlift, strength("quads")])).toBe("LEGS");
  });

  it("erkennt Ganzkörper, wenn Ober- und Unterkörper ohne Rumpf je mindestens 25 % ausmachen", () => {
    // Leas „Ganzkörper B“: Kreuzheben, Schulterdrücken, Rudern, Plank. Unterkörper ⅔ von 2⅔ = 25 %.
    const deadlift = strength("hamstrings", "glutes", "lower_back");
    expect(
      detectPlanType([
        deadlift,
        strength("front_delts"),
        strength("upper_back", "lats"),
        strength("abs"),
      ]),
    ).toBe("FULLBODY");
    expect(detectPlanType([strength("chest"), strength("lats"), strength("quads")])).toBe(
      "FULLBODY",
    );
    // Beine hat Vorrang: 3 von 4 Übungen Unterkörper.
    expect(
      detectPlanType([
        strength("quads"),
        strength("quads"),
        strength("hamstrings"),
        strength("chest"),
      ]),
    ).toBe("LEGS");
  });

  it("ignoriert Cardio und Mobility und liefert ohne Übungen Ganzkörper", () => {
    expect(
      detectPlanType([
        { category: "cardio", primaryMuscles: ["quads"] },
        { category: "mobility", primaryMuscles: ["glutes"] },
        strength("chest"),
      ]),
    ).toBe("UPPER");
    expect(detectPlanType([])).toBe("FULLBODY");
  });
});

describe("planSetSchema", () => {
  it("setzt bei fester Wiederholungszahl das Maximum gleich dem Minimum", () => {
    const set = planSetSchema.parse({ kind: "working", repsMin: 8 });
    expect(set).toEqual({
      kind: "working",
      repsMin: 8,
      repsMax: 8,
      durationSeconds: null,
      weightKg: null,
      rir: null,
    });
  });

  it("verlangt entweder Wiederholungen oder eine Dauer", () => {
    expect(planSetSchema.safeParse({ kind: "working" }).success).toBe(false);
    expect(
      planSetSchema.safeParse({ kind: "working", repsMin: 8, durationSeconds: 30 }).success,
    ).toBe(false);
    expect(planSetSchema.safeParse({ kind: "working", durationSeconds: 45 }).success).toBe(true);
  });

  it("lehnt einen Bereich ab, dessen Maximum kleiner als das Minimum ist", () => {
    const result = planSetSchema.safeParse({ kind: "working", repsMin: 10, repsMax: 8 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["repsMax"]);
  });
});

describe("planContentSchema", () => {
  it("erlaubt Warm-up als Freitext oder Katalog-Übung", () => {
    const result = planContentSchema.safeParse({
      name: "Block 1",
      days: [
        {
          name: "Tag A",
          warmup: [
            { name: "5 min Rad", details: "locker" },
            { exerciseId: "6acd3920c0072ec254663c01" },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data?.days[0]?.warmup[1]).toMatchObject({ name: "", details: null });
    expect(
      planContentSchema.safeParse({ name: "Block 1", days: [{ name: "A", warmup: [{}] }] }).success,
    ).toBe(false);
  });
});
