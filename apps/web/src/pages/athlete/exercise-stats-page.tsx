import { ArrowLeft, TrendingUp } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyStats } from "@/features/stats/api";
import { ExerciseStatsList } from "@/features/stats/exercise-list";

export default function AthleteExerciseStatsPage() {
  const stats = useMyStats();
  return (
    <>
      <Link
        to="/fortschritt"
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Fortschritt
      </Link>
      <PageHeader title="Übungen" description="Aktueller Stand und Entwicklung je Übung" />
      <QueryState query={stats} loading={<SkeletonList rows={6} className="h-16" />}>
        {(data) =>
          data.items.length === 0 ? (
            <div className="bg-surface rounded-tile">
              <EmptyState
                icon={TrendingUp}
                title="Noch keine Übungen"
                description="Sobald du dein erstes Training abschließt, siehst du hier deine Entwicklung je Übung."
                action={
                  <Link
                    to="/plan"
                    className="bg-primary text-on-primary hover:bg-primary-hover inline-flex min-h-11 items-center rounded-card px-4 text-sm font-medium"
                  >
                    Zum Training
                  </Link>
                }
              />
            </div>
          ) : (
            <ExerciseStatsList data={data} href={(exerciseId) => `/fortschritt/${exerciseId}`} />
          )
        }
      </QueryState>
    </>
  );
}
