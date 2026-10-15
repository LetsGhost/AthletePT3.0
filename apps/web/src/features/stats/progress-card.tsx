import { TrendingUp } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";

import { useAthleteStats } from "./api";
import { StatsOverview } from "./stats-overview";

/** Fortschritt eines Athleten auf seiner Detailseite (Coach). */
export function AthleteProgressCard({
  athleteId,
  athleteName,
}: {
  athleteId: string;
  athleteName: string;
}) {
  const stats = useAthleteStats(athleteId);

  return (
    <Card>
      <CardHeader title="Fortschritt" icon={TrendingUp} iconClassName="text-module-weight" />
      <CardBody>
        <QueryState query={stats} loading={<SkeletonList rows={3} className="h-16" />}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Noch keine Daten"
                description={`Sobald ${athleteName} Trainings abschließt, siehst du hier Bestwerte und Verlauf.`}
              />
            ) : (
              <StatsOverview
                data={data}
                level="h3"
                href={(exerciseId) => `/coach/athletes/${athleteId}/progress/${exerciseId}`}
              />
            )
          }
        </QueryState>
      </CardBody>
    </Card>
  );
}
