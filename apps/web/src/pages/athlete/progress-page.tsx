import { TrendingUp } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyStats } from "@/features/stats/api";
import { StatsOverview } from "@/features/stats/stats-overview";

export default function AthleteProgressPage() {
  const stats = useMyStats();

  return (
    <>
      <PageHeader title="Fortschritt" description="Deine Bestwerte und wie sie sich entwickeln." />
      <QueryState query={stats} loading={<SkeletonList rows={5} className="h-16" />}>
        {(data) =>
          data.items.length === 0 ? (
            <div className="bg-surface rounded-card">
              <EmptyState
                icon={TrendingUp}
                title="Noch keine Daten"
                description="Schließe dein erstes Training ab, dann siehst du hier deine Entwicklung."
                action={
                  <Link to="/plan" className="text-accent underline underline-offset-4">
                    Zum Trainingsplan
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="bg-surface rounded-card p-4">
              <StatsOverview data={data} href={(id) => `/progress/${id}`} />
            </div>
          )
        }
      </QueryState>
    </>
  );
}
