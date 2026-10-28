import {
  badgeTierLabels,
  challengeKindLabels,
  challengeMetricGroup,
  challengeMetricGroupLabels,
  type ChallengeKind,
  type ChallengeMetric,
  type ChallengeStanding,
} from "@athletept/shared";
import { Medal } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

import { formatScore } from "./format";
import { kindIcon, kindTone, metricGroupIcon, tierTone } from "./tones";

export function KindBadge({ kind }: { kind: ChallengeKind }) {
  const Icon = kindIcon[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-[11px] font-semibold",
        kindTone[kind].text,
        kindTone[kind].tint,
      )}
    >
      <Icon aria-hidden="true" className="size-3" strokeWidth={2.4} />
      {challengeKindLabels[kind]}
    </span>
  );
}

export function MetricChip({ metric }: { metric: ChallengeMetric }) {
  const Icon = metricGroupIcon[challengeMetricGroup[metric]];
  return (
    <span className="bg-inset inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-[11px] font-medium">
      <Icon aria-hidden="true" className="text-muted size-3" strokeWidth={2.4} />
      {challengeMetricGroupLabels[challengeMetricGroup[metric]]}
    </span>
  );
}

/** Quadratisches Icon in Farbe der Art, z. B. in Listen. */
export function ChallengeIcon({
  kind,
  metric,
  className,
}: {
  kind: ChallengeKind;
  metric: ChallengeMetric;
  className?: string;
}) {
  const Icon = metricGroupIcon[challengeMetricGroup[metric]];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl",
        kindTone[kind].tint,
        className,
      )}
    >
      <Icon className={cn("size-5", kindTone[kind].text)} />
    </span>
  );
}

export function ChallengeBar({
  kind,
  ratio,
  label,
  className,
}: {
  kind: ChallengeKind;
  ratio: number;
  label: string;
  className?: string;
}) {
  const percent = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("bg-inset h-1.5 overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", kindTone[kind].fill)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** Ring mit Wert in der Mitte (Detailseite, Eintragen). */
export function ChallengeRing({
  kind,
  ratio,
  label,
  size = 96,
  children,
}: {
  kind: ChallengeKind;
  ratio: number;
  label: string;
  size?: number;
  children: ReactNode;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, ratio)) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" className="size-full -rotate-90" role="img" aria-label={label}>
        <circle cx="48" cy="48" r={radius} fill="none" strokeWidth="8" className="stroke-inset" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className={cn("transition-[stroke-dasharray]", kindTone[kind].text)}
          stroke="currentColor"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>
    </div>
  );
}

const rankTone = ["text-challenge-coach", "text-muted", "text-module-streak"];

/** Rangliste mit hervorgehobener eigener Zeile. */
export function Standings({
  standings,
  metric,
  showGaps = false,
}: {
  standings: readonly ChallengeStanding[];
  metric: ChallengeMetric;
  /** Gekürzte Rangliste: „···“ zwischen nicht aufeinanderfolgenden Plätzen. */
  showGaps?: boolean;
}) {
  return (
    <ol className="bg-surface flex flex-col rounded-tile p-1.5">
      {standings.map((standing, index) => (
        <Fragment key={standing.athleteId}>
          {showGaps && index > 0 && standing.rank - standings[index - 1]!.rank > 1 && (
            <li aria-hidden="true" className="text-muted py-0.5 text-center tracking-[3px]">
              ···
            </li>
          )}
          <li
            aria-current={standing.isMe ? "true" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
              standing.isMe ? "border-primary bg-primary/25" : "border-transparent",
            )}
          >
            <span
              className={cn(
                "w-8 text-center text-sm font-bold tabular-nums",
                standing.score > 0 ? (rankTone[standing.rank - 1] ?? "text-muted") : "text-muted",
              )}
            >
              {standing.rank}
              <span className="sr-only">. Platz</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                standing.isMe ? "bg-primary text-on-primary" : "bg-inset",
              )}
            >
              {initials(standing.name)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {standing.name}
              {standing.isMe && <span className="text-muted"> (du)</span>}
            </span>
            {standing.tier && (
              <Medal
                aria-label={badgeTierLabels[standing.tier]}
                className={cn("size-4 shrink-0", tierTone[standing.tier])}
              />
            )}
            <span className="text-sm font-semibold tabular-nums">
              {formatScore(metric, standing.score)}
            </span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
