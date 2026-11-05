import type { ExerciseStatsSummary } from "@athletept/shared";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { formatWeekdayDate } from "@/features/workouts/format";
import { cn } from "@/lib/cn";

import { changeTone, formatPercent } from "./format";

/** Rückgang in Warnfarbe statt Rot: ein Hinweis, kein Fehler. */
const toneClasses = { up: "text-success", down: "text-warning", neutral: "text-muted" } as const;

export function ChangeBadge({
  summary,
  className,
}: {
  summary: ExerciseStatsSummary;
  className?: string;
}) {
  const { change } = summary;
  if (!change) return null;
  const tone = changeTone(change);
  const Icon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-[1.1em]" />
      {formatPercent(change.percent)}
      <span className="sr-only"> seit {formatWeekdayDate(change.fromDate)}</span>
    </span>
  );
}

const WIDTH = 56;
const HEIGHT = 20;
const PAD = 2;

/** Mini-Verlaufskurve der letzten Werte, Farbe nach Veränderung. Rein dekorativ. */
export function Sparkline({
  summary,
  className,
}: {
  summary: ExerciseStatsSummary;
  className?: string;
}) {
  const { trend } = summary;
  if (trend.length < 2) return null;
  const min = Math.min(...trend);
  const range = Math.max(...trend) - min;
  const points = trend
    .map((value, index) => {
      const x = PAD + (index / (trend.length - 1)) * (WIDTH - 2 * PAD);
      const y =
        range === 0 ? HEIGHT / 2 : HEIGHT - PAD - ((value - min) / range) * (HEIGHT - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("h-5 w-12 shrink-0", toneClasses[changeTone(summary.change)], className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
