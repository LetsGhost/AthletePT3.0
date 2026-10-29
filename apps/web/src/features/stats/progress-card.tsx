import type { ExerciseStatsListResponse } from "@athletept/shared";
import type { UseQueryResult } from "@tanstack/react-query";
import { ChevronDown, TrendingUp } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { cn } from "@/lib/cn";

import { useAthleteStats, useMyStats } from "./api";
import { StatsOverview } from "./stats-overview";

interface WeightAnalysisCardProps {
  query: UseQueryResult<ExerciseStatsListResponse>;
  href: (exerciseId: string) => string;
  empty: ReactNode;
  /** Überschriften-Ebene der Abschnitte im Inhalt. */
  level?: "h2" | "h3";
}

/** Rekorde und alle Übungen. Eingeklappt nur eine Vorschau, ein Klick zeigt alles. */
export function WeightAnalysisCard({ query, href, empty, level = "h3" }: WeightAnalysisCardProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const count = query.data?.items.length ?? 0;

  return (
    <Card>
      <CardHeader title="Gewichtsanalyse" icon={TrendingUp} iconClassName="text-module-weight" />
      <CardBody className="flex flex-col gap-3">
        <QueryState query={query} loading={<SkeletonList rows={2} className="h-20" />}>
          {(data) =>
            data.items.length === 0 ? (
              empty
            ) : (
              <div id={contentId}>
                <StatsOverview data={data} href={href} level={level} preview={!expanded} />
              </div>
            )
          }
        </QueryState>
        {count > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded(!expanded)}
            className="text-accent hover:bg-inset flex min-h-11 items-center justify-center gap-1 rounded-card text-sm font-medium"
          >
            {expanded ? "Weniger anzeigen" : `Alle ${count} Übungen anzeigen`}
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}
      </CardBody>
    </Card>
  );
}

export function MyWeightAnalysisCard() {
  return (
    <WeightAnalysisCard
      query={useMyStats()}
      href={(exerciseId) => `/fortschritt/${exerciseId}`}
      empty={
        <EmptyState
          icon={TrendingUp}
          title="Noch keine Daten"
          description="Schließe dein erstes Training ab, dann siehst du hier Bestwerte und Verlauf."
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
      empty={
        <EmptyState
          icon={TrendingUp}
          title="Noch keine Daten"
          description={`Sobald ${athleteName} Trainings abschließt, siehst du hier Bestwerte und Verlauf.`}
        />
      }
    />
  );
}
