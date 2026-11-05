import { STATS_TOP_COUNT, type ExerciseStatsListResponse } from "@athletept/shared";
import type { UseQueryResult } from "@tanstack/react-query";
import { ChevronRight, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { EmptyState } from "@/components/ui/empty-state";
import { QueryState } from "@/components/ui/query-state";

import { useAthleteStats, useMyStats } from "./api";
import { ChangeBadge, Sparkline } from "./change";
import { mainCurrent } from "./format";

interface WeightAnalysisCardProps {
  query: UseQueryResult<ExerciseStatsListResponse>;
  href: (exerciseId: string) => string;
  /** Liste aller Übungen. */
  listHref: string;
  empty: ReactNode;
}

/** Die stärksten Übungen als Kacheln mit Verlauf, dazu der Weg zur vollständigen Liste. */
export function WeightAnalysisCard({ query, href, listHref, empty }: WeightAnalysisCardProps) {
  return (
    <section
      aria-labelledby="weight-analysis"
      className="bg-surface flex flex-col gap-3 rounded-tile p-3.5 pb-2.5"
    >
      <div className="flex items-center gap-2.5">
        <span className="bg-module-weight/15 flex size-9 shrink-0 items-center justify-center rounded-[0.625rem]">
          <TrendingUp aria-hidden="true" className="text-module-weight size-[1.125rem]" />
        </span>
        <h2 id="weight-analysis" className="font-semibold">
          Gewichtsanalyse
        </h2>
      </div>
      <QueryState query={query} loading={<div className="skeleton h-48 rounded-card" />}>
        {(data) => {
          if (data.items.length === 0) return empty;
          // Stärkste Übungen (geschätztes Maximum) zuerst, mit den übrigen auf 4 aufgefüllt.
          const tiles = [
            ...data.records,
            ...data.items.filter(
              (item) => !data.records.some((r) => r.exerciseId === item.exerciseId),
            ),
          ].slice(0, STATS_TOP_COUNT);
          return (
            <>
              <ul className="grid grid-cols-2 gap-2">
                {tiles.map((item) => (
                  <li key={item.exerciseId} className="min-w-0">
                    <Link
                      to={href(item.exerciseId)}
                      className="bg-inset hover:border-border-strong flex h-full flex-col gap-1.5 rounded-card border border-transparent p-3 transition-colors"
                    >
                      <span className="truncate text-sm">{item.exerciseName}</span>
                      <span className="text-xl leading-tight font-semibold tabular-nums">
                        {mainCurrent(item)}
                      </span>
                      <span className="flex items-center justify-between gap-1.5">
                        <Sparkline summary={item} />
                        <ChangeBadge summary={item} className="text-xs" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to={listHref}
                className="text-accent hover:bg-inset flex min-h-11 items-center justify-center gap-1 rounded-card text-sm font-medium"
              >
                {data.items.length === 1 ? "Zur Übungsliste" : `Alle ${data.items.length} Übungen`}
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}

export function MyWeightAnalysisCard() {
  return (
    <WeightAnalysisCard
      query={useMyStats()}
      href={(exerciseId) => `/fortschritt/${exerciseId}`}
      listHref="/fortschritt/uebungen"
      empty={
        <EmptyState
          icon={TrendingUp}
          title="Noch keine Daten"
          description="Schließe dein erstes Training ab, dann siehst du hier deine Entwicklung je Übung."
        />
      }
    />
  );
}

/** Auf der Detailseite eines Athleten (Coach). */
export function AthleteWeightAnalysisCard({
  athleteId,
  athleteName,
}: {
  athleteId: string;
  athleteName: string;
}) {
  return (
    <WeightAnalysisCard
      query={useAthleteStats(athleteId)}
      href={(exerciseId) => `/coach/athletes/${athleteId}/entwicklung/${exerciseId}`}
      listHref={`/coach/athletes/${athleteId}/entwicklung`}
      empty={
        <EmptyState
          icon={TrendingUp}
          title="Noch keine Daten"
          description={`Sobald ${athleteName} Trainings abschließt, siehst du hier die Entwicklung je Übung.`}
        />
      }
    />
  );
}
