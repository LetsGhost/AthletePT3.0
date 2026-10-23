import {
  isoWeekOf,
  isoWeekStart,
  shiftIsoWeek,
  todayIsoDate,
  type WorkoutLogSummary,
} from "@athletept/shared";
import { ChevronDown, History, Star } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { viaAppText } from "@/features/api-keys/labels";
import { useMyWorkouts } from "@/features/workouts/api";
import { formatWeekRange } from "@/features/workouts/format";
import { WorkoutStatusBadge } from "@/features/workouts/workout-status-badge";
import { cn } from "@/lib/cn";
import { parseIsoDate } from "@/lib/format";

const weekdayShort = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

interface WeekGroup {
  week: string;
  logs: WorkoutLogSummary[];
}

/** Trainings (neueste zuerst) nach ISO-Woche gruppieren, Reihenfolge bleibt erhalten. */
function groupByWeek(logs: readonly WorkoutLogSummary[]): WeekGroup[] {
  const groups: WeekGroup[] = [];
  for (const log of logs) {
    const week = isoWeekOf(log.date);
    const last = groups.at(-1);
    if (last?.week === week) last.logs.push(log);
    else groups.push({ week, logs: [log] });
  }
  return groups;
}

function weekTitle(week: string) {
  const current = isoWeekOf(todayIsoDate());
  if (week === current) return "Diese Woche";
  if (week === shiftIsoWeek(current, -1)) return "Letzte Woche";
  return `KW ${Number(week.slice(6))}`;
}

function weekSummary(logs: readonly WorkoutLogSummary[]) {
  const done = logs.filter((log) => log.status === "completed");
  const sets = done.reduce((sum, log) => sum + log.doneSetCount, 0);
  return `${done.length} ${done.length === 1 ? "Einheit" : "Einheiten"} · ${sets} ${sets === 1 ? "Satz" : "Sätze"}`;
}

function metaText(log: WorkoutLogSummary) {
  const parts =
    log.status === "skipped"
      ? [log.notes ? `Grund: ${log.notes}` : "Ohne Begründung"]
      : [`${log.doneSetCount} ${log.doneSetCount === 1 ? "Satz" : "Sätze"}`];
  const via = viaAppText(log.lastWriteVia);
  if (via) parts.push(via);
  return parts.join(" · ");
}

function ratingTone(rating: number) {
  if (rating >= 8) return "bg-accent/15 text-accent";
  if (rating >= 7) return "bg-surface group-hover:bg-inset";
  return "bg-warning/15 text-warning";
}

function WorkoutRow({ log }: { log: WorkoutLogSummary }) {
  const skipped = log.status === "skipped";
  return (
    <Link
      to={`/workouts/${log.id}`}
      className="group hover:bg-surface flex items-center gap-3 p-3 pl-2.5 transition-colors"
    >
      <span
        className={cn(
          "flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl",
          // Beim Hover wird die Zeile surface, die Box tauscht auf inset, damit sie sichtbar bleibt.
          skipped ? "bg-bg" : "bg-surface group-hover:bg-inset",
        )}
      >
        <span className="text-muted text-[10px] font-semibold uppercase tracking-wide">
          {weekdayShort.format(parseIsoDate(log.date)).replace(".", "")}
        </span>
        <span className={cn("text-lg leading-tight font-semibold", skipped && "text-muted")}>
          {Number(log.date.slice(8))}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate font-semibold", skipped && "text-muted")}>{log.dayName}</span>
        <span className="text-muted truncate text-xs">{metaText(log)}</span>
        {!skipped && log.notes && <span className="truncate text-xs">„{log.notes}“</span>}
      </span>
      {log.status === "completed" ? (
        log.rating !== null && (
          <span
            aria-label={`Bewertung ${log.rating} von 10`}
            className={cn(
              "flex h-7 min-w-10 shrink-0 items-center justify-center gap-1 rounded-lg px-1.5 text-sm font-semibold",
              ratingTone(log.rating),
            )}
          >
            <Star aria-hidden="true" className="size-3 fill-current" />
            {log.rating}
          </span>
        )
      ) : (
        <WorkoutStatusBadge status={log.status} />
      )}
    </Link>
  );
}

export default function AthleteWorkoutsPage() {
  const workouts = useMyWorkouts();

  return (
    <>
      <PageHeader title="Verlauf" description="Deine bisherigen Trainings." />
      <QueryState query={workouts} loading={<SkeletonList rows={5} className="h-16" />}>
        {(data) => {
          // Kommt zwischen zwei Seiten ein neues Training dazu, verschiebt sich die nächste Seite um eins.
          const logs = [
            ...new Map(
              data.pages.flatMap((page) => page.items).map((log) => [log.id, log]),
            ).values(),
          ];
          if (logs.length === 0) {
            return (
              <div className="bg-surface rounded-card">
                <EmptyState
                  icon={History}
                  title="Noch keine Trainings"
                  description="Starte ein Training über deinen Plan, dann erscheint es hier."
                  action={
                    <Link to="/plan" className="text-accent underline underline-offset-4">
                      Zum Trainingsplan
                    </Link>
                  }
                />
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-4">
              {groupByWeek(logs).map(({ week, logs: weekLogs }) => (
                <section
                  key={week}
                  aria-labelledby={`week-${week}`}
                  className="flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-0.5 pt-1">
                    <span className="flex items-baseline gap-2">
                      <h2 id={`week-${week}`} className="text-sm font-semibold">
                        {weekTitle(week)}
                      </h2>
                      <span className="text-muted text-xs">
                        {formatWeekRange(isoWeekStart(week))}
                      </span>
                    </span>
                    <span className="text-muted text-xs">{weekSummary(weekLogs)}</span>
                  </div>
                  <ul className="bg-inset divide-border rounded-card divide-y overflow-hidden">
                    {weekLogs.map((log) => (
                      <li key={log.id}>
                        <WorkoutRow log={log} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {workouts.hasNextPage && (
                <Button
                  variant="secondary"
                  loading={workouts.isFetchingNextPage}
                  onClick={() => void workouts.fetchNextPage()}
                >
                  <ChevronDown aria-hidden="true" className="size-4" /> Ältere Trainings laden
                </Button>
              )}
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
