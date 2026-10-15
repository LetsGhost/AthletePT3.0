import type { ExerciseStatsListResponse, ExerciseStatsSummary } from "@athletept/shared";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Trophy } from "lucide-react";
import { Link } from "react-router";

import { formatWeekdayDate } from "@/features/workouts/format";
import { cn } from "@/lib/cn";

import { changeTone, formatPercent, formatRecordValue, mainBest } from "./format";

export function ChangeBadge({ summary }: { summary: ExerciseStatsSummary }) {
  const { change } = summary;
  if (!change) return null;
  const tone = changeTone(change);
  const Icon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium whitespace-nowrap",
        tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-muted",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {formatPercent(change.percent)}
      <span className="sr-only"> seit {formatWeekdayDate(change.fromDate)}</span>
    </span>
  );
}

interface StatsOverviewProps {
  data: ExerciseStatsListResponse;
  href: (exerciseId: string) => string;
  /** Überschriften-Ebene der Abschnitte. */
  level?: "h2" | "h3";
}

/** Rekorde (Top 4) und alle trainierten Übungen mit Bestwert und Veränderung. */
export function StatsOverview({ data, href, level = "h2" }: StatsOverviewProps) {
  const Heading = level;
  return (
    <div className="flex flex-col gap-6">
      {data.records.length > 0 && (
        <section aria-labelledby="stats-records" className="flex flex-col gap-3">
          <Heading id="stats-records" className="flex items-center gap-2 font-medium">
            <Trophy aria-hidden="true" className="text-module-records size-5" /> Rekorde
          </Heading>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.records.map((record) => (
              <li key={record.exerciseId}>
                <Link
                  to={href(record.exerciseId)}
                  className="bg-inset hover:border-border-strong flex h-full flex-col gap-1 rounded-card border border-transparent p-3 transition-colors"
                >
                  <span className="font-medium">{record.exerciseName}</span>
                  <span className="text-2xl font-medium tabular-nums">{mainBest(record)}</span>
                  <span className="text-muted flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      Geschätztes Maximum
                      {record.best.topWeightKg &&
                        ` · max. ${formatRecordValue("topWeightKg", record.best.topWeightKg.value)}`}
                    </span>
                    <ChangeBadge summary={record} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="stats-all" className="flex flex-col gap-3">
        <Heading id="stats-all" className="font-medium">
          Alle Übungen
        </Heading>
        <ul className="flex flex-col gap-2">
          {data.items.map((item) => (
            <li key={item.exerciseId}>
              <Link
                to={href(item.exerciseId)}
                className="bg-inset hover:border-border-strong flex items-center gap-3 rounded-card border border-transparent p-3 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.exerciseName}</span>
                  <span className="text-muted block text-sm">
                    {item.sessionCount} {item.sessionCount === 1 ? "Einheit" : "Einheiten"} ·
                    zuletzt {formatWeekdayDate(item.lastDate)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <span className="font-medium tabular-nums">{mainBest(item)}</span>
                  <ChangeBadge summary={item} />
                </span>
                <ChevronRight aria-hidden="true" className="text-muted size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
