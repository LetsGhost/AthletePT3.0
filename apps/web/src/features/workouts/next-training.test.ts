import type { PlanDay, WeekPlanDay } from "@athletept/shared";
import { describe, expect, it } from "vitest";

import { buildPlan, buildWeekView } from "@/test/server";

import {
  estimateMinutes,
  exerciseScheme,
  findNextTraining,
  workingSetCount,
} from "./next-training";

const base = buildPlan().days[0]!;
const day = (id: string, weekday: number | null, name = id): PlanDay => ({
  ...base,
  id,
  name,
  weekday,
});
const status = (dayId: string, s: WeekPlanDay["status"]): WeekPlanDay => ({
  dayId,
  name: dayId,
  type: "UPPER",
  weekday: null,
  status: s,
  logs: [],
});

// buildWeekView: Woche ab Mo 12.10., heute Di 13.10.
const mon = day("a", 1);
const thu = day("b", 4);
const flex = day("c", null);

describe("Nächstes Training", () => {
  it("nimmt den nächsten offenen Tag ab heute", () => {
    const next = findNextTraining([mon, thu], buildWeekView());
    expect(next).toMatchObject({ kind: "planned", date: "2026-10-15" });
    expect(next?.day.id).toBe("b");
  });

  it("nimmt danach flexible Tage, dann verpasste", () => {
    expect(findNextTraining([mon, flex], buildWeekView())).toMatchObject({
      kind: "planned",
      date: null,
    });
    expect(findNextTraining([mon], buildWeekView())).toMatchObject({
      kind: "overdue",
      date: "2026-10-12",
    });
  });

  it("zeigt bei erledigter Woche den ersten Tag der nächsten", () => {
    const week = buildWeekView({ days: [status("a", "completed"), status("b", "skipped")] });
    expect(findNextTraining([thu, mon], week)).toMatchObject({
      kind: "nextWeek",
      date: "2026-10-19",
    });
  });

  it("bevorzugt ein laufendes Training", () => {
    const week = buildWeekView({
      inProgress: {
        id: "6acd3920c0072ec254663e09",
        planId: "6acd3920c0072ec254663d01",
        dayId: "a",
        dayName: "a",
        dayType: "UPPER",
        date: "2026-10-12",
        status: "in_progress",
        rating: null,
        notes: null,
        exerciseCount: 1,
        doneSetCount: 0,
        completedAt: null,
      },
    });
    expect(findNextTraining([mon, thu], week)).toMatchObject({ kind: "running" });
  });

  it("gibt ohne Tage nichts zurück", () => {
    expect(findNextTraining([], buildWeekView())).toBeNull();
  });
});

describe("Eckdaten eines Tags", () => {
  it("zählt Arbeitssätze, schätzt die Dauer und fasst das Schema zusammen", () => {
    // 1 Warm-up-Eintrag (3 min), 4 Sätze à 40 s, 3 Pausen à 120 s → 3 + 2:40 + 6 = 11:40 → 10.
    expect(workingSetCount(base)).toBe(3);
    expect(estimateMinutes(base)).toBe(10);
    expect(exerciseScheme(base.exercises[0]!)).toBe("3 × 6–8 Wdh. · 80 kg · RIR 2");
  });
});
