import type {
  ExerciseChange,
  ExerciseStatsSummary,
  RecordKind,
  StatsMetric,
} from "@athletept/shared";

import { formatDuration } from "@/features/plans/format";
import { formatNumber } from "@/lib/format";

/** „97,5 kg“, „12 Wdh.“, „1 min“. */
export function formatRecordValue(kind: RecordKind, value: number) {
  if (kind === "maxReps") return `${value} Wdh.`;
  if (kind === "maxDurationSeconds") return formatDuration(value);
  return `${formatNumber(value)} kg`;
}

export const metricLabels: Record<StatsMetric, string> = {
  estimated1rm: "Geschätztes Maximum",
  topWeightKg: "Höchstes Gewicht",
  maxReps: "Meiste Wiederholungen",
  maxDurationSeconds: "Längste Dauer",
};

/** „+5 %“, „−2,3 %“, „±0 %“ (mit echtem Minuszeichen). */
export function formatPercent(percent: number) {
  if (percent === 0) return "±0 %";
  const sign = percent > 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(percent))} %`;
}

export function changeTone(change: ExerciseChange | null) {
  if (!change || change.percent === 0) return "neutral" as const;
  return change.percent > 0 ? ("up" as const) : ("down" as const);
}

/** Bestwert der Hauptkennzahl, z. B. „116,7 kg“. */
export function mainBest(summary: ExerciseStatsSummary) {
  const record = summary.best[summary.metric];
  return record ? formatRecordValue(summary.metric, record.value) : "–";
}
