import type { PlanSet } from "@athletept/shared";

import type { EditorSet } from "./editor-values";
import { formatSetGroup, groupSets } from "./format";

const toPlanSet = (set: EditorSet): PlanSet => ({
  kind: set.kind,
  repsMin: set.repsMin ?? null,
  repsMax: set.repsMax ?? null,
  durationSeconds: set.durationSeconds ?? null,
  weightKg: set.weightKg ?? null,
  rir: set.rir ?? null,
});

/** „3 × 6–8 Wdh. · 80 kg · RIR 2 · +1 Aufwärmen“ */
export function summarizeSets(sets: readonly EditorSet[]) {
  const working = sets.filter((set) => set.kind === "working").map(toPlanSet);
  const warmups = sets.length - working.length;
  const groups = groupSets(working);
  let text: string;
  if (working.length === 0) {
    text = warmups > 0 ? "Noch keine Arbeitssätze" : "Noch keine Sätze";
  } else if (groups.length === 1 && groups[0]!.text) {
    text = formatSetGroup(groups[0]!);
  } else {
    text = `${working.length} Arbeitssätze, unterschiedlich`;
  }
  return warmups > 0 ? `${text} · +${warmups} Aufwärmen` : text;
}

/** Namen der Sätze wie in den Kacheln: Aufwärmsätze mit „W“, Arbeitssätze durchgezählt. */
export function setNames(sets: readonly Pick<EditorSet, "kind">[]) {
  const warmupCount = sets.filter((set) => set.kind === "warmup").length;
  let working = 0;
  let warmup = 0;
  return sets.map((set) => {
    if (set.kind === "warmup") {
      warmup += 1;
      return { badge: "W", name: warmupCount > 1 ? `Aufwärmsatz ${warmup}` : "Aufwärmsatz" };
    }
    working += 1;
    return { badge: String(working), name: `Satz ${working}` };
  });
}
