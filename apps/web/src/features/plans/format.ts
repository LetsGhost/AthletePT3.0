import { weekdayLabels, type PlanSet, type Weekday } from "@athletept/shared";

import { formatNumber } from "@/lib/format";

/** Wochentag eines Trainingstags, ohne Angabe „Flexibel“. */
export function weekdayLabel(weekday: number | null) {
  return weekday ? weekdayLabels[weekday as Weekday] : "Flexibel";
}

/** „8“, „8–10“ oder „45 s“. */
export function formatTarget(set: Pick<PlanSet, "repsMin" | "repsMax" | "durationSeconds">) {
  if (set.durationSeconds !== null) return formatDuration(set.durationSeconds);
  if (set.repsMin === null) return "";
  const reps =
    set.repsMax !== null && set.repsMax !== set.repsMin
      ? `${set.repsMin}–${set.repsMax}`
      : `${set.repsMin}`;
  return `${reps} Wdh.`;
}

export function formatDuration(seconds: number) {
  if (seconds < 60 || seconds % 60 !== 0) return `${seconds} s`;
  return `${seconds / 60} min`;
}

/** Pausenangabe: „90 s Pause“, „2 min Pause“. */
export function formatRest(seconds: number | null) {
  return seconds === null ? null : `${formatDuration(seconds)} Pause`;
}

function describe(set: PlanSet) {
  return [
    formatTarget(set),
    set.weightKg !== null ? `${formatNumber(set.weightKg)} kg` : null,
    set.rir !== null ? `RIR ${set.rir}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export interface SetGroup {
  kind: PlanSet["kind"];
  count: number;
  text: string;
}

/**
 * Fasst gleiche aufeinanderfolgende Sätze zusammen:
 * `[{ warmup, 1, "10 Wdh. · 40 kg" }, { working, 3, "6–8 Wdh. · 80 kg · RIR 2" }]`.
 */
export function groupSets(sets: readonly PlanSet[]): SetGroup[] {
  const groups: SetGroup[] = [];
  for (const set of sets) {
    const text = describe(set);
    const last = groups.at(-1);
    if (last && last.kind === set.kind && last.text === text) last.count += 1;
    else groups.push({ kind: set.kind, count: 1, text });
  }
  return groups;
}

/** „3 × 6–8 Wdh. · 80 kg · RIR 2“ */
export function formatSetGroup(group: SetGroup) {
  return `${group.count} × ${group.text}`;
}

export interface ShorthandSet {
  kind: "working";
  repsMin: number | null;
  repsMax: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
  rir: number | null;
}

const shorthand =
  /^(\d{1,2})\s*[x×*]\s*(?:(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?|(\d{1,4})\s*s(?:ek|ec)?)\s*(?:@\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:kg)?)?\s*(?:rir\s*(\d{1,2}))?$/i;

/**
 * Schnelleingabe für Arbeitssätze: „4x8“, „3 × 8–10 @ 80 kg“, „3x6-8@100 RIR 2“, „3x45s“.
 * Liefert `null`, wenn der Text nicht passt.
 */
export function parseSetShorthand(input: string): ShorthandSet[] | null {
  const match = shorthand.exec(input.trim());
  if (!match) return null;
  const [, count, repsMin, repsMax, seconds, weight, rir] = match;
  const sets = Number(count);
  if (sets < 1 || sets > 10) return null;
  const set: ShorthandSet = {
    kind: "working",
    repsMin: repsMin ? Number(repsMin) : null,
    repsMax: repsMin ? Number(repsMax ?? repsMin) : null,
    durationSeconds: seconds ? Number(seconds) : null,
    weightKg: weight ? Number(weight.replace(",", ".")) : null,
    rir: rir ? Number(rir) : null,
  };
  if (set.repsMin !== null && set.repsMax !== null && set.repsMax < set.repsMin) return null;
  return Array.from({ length: sets }, () => ({ ...set }));
}
