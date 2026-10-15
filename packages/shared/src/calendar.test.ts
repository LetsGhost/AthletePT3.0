import { describe, expect, it } from "vitest";

import {
  addDays,
  isoWeekOf,
  isoWeekSchema,
  isoWeekStart,
  isoWeekday,
  shiftIsoWeek,
  todayIsoDate,
} from "./calendar";

describe("Kalender", () => {
  it("bestimmt heute in deutscher Zeit, nicht in UTC", () => {
    // 23:30 UTC am 31.12. ist in Berlin schon Neujahr.
    expect(todayIsoDate(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    // Sommerzeit: 22:30 UTC ist 00:30 Uhr am Folgetag.
    expect(todayIsoDate(new Date("2026-07-14T22:30:00Z"))).toBe("2026-07-15");
  });

  it("rechnet mit Kalendertagen über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(isoWeekday("2026-10-12")).toBe(1);
    expect(isoWeekday("2026-10-18")).toBe(7);
  });

  it("ermittelt ISO-Wochen samt Wochenjahr", () => {
    expect(isoWeekOf("2026-10-13")).toBe("2026-W42");
    // Der 1.1.2027 ist ein Freitag und gehört zur letzten Woche 2026 (W53).
    expect(isoWeekOf("2027-01-01")).toBe("2026-W53");
    // Der 29.12.2025 ist ein Montag und gehört schon zu 2026-W01.
    expect(isoWeekOf("2025-12-29")).toBe("2026-W01");
    expect(isoWeekStart("2026-W42")).toBe("2026-10-12");
    expect(isoWeekStart("2026-W01")).toBe("2025-12-29");
    expect(shiftIsoWeek("2026-W53", 1)).toBe("2027-W01");
    expect(shiftIsoWeek("2026-W01", -1)).toBe("2025-W52");
  });

  it("akzeptiert nur existierende Wochen", () => {
    expect(isoWeekSchema.safeParse("2026-W53").success).toBe(true);
    expect(isoWeekSchema.safeParse("2027-W53").success).toBe(false);
    expect(isoWeekSchema.safeParse("2026-W00").success).toBe(false);
    expect(isoWeekSchema.safeParse("2026-42").success).toBe(false);
  });
});
