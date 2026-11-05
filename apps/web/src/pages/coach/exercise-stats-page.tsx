import { ArrowLeft, TrendingUp } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useAthleteStats } from "@/features/stats/api";
import { ExerciseStatsList } from "@/features/stats/exercise-list";

export default function CoachExerciseStatsPage() {
  const { id = "" } = useParams();
  const stats = useAthleteStats(id);
  return (
    <>
      <Link
        to={`/coach/athletes/${id}`}
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Zum Athleten
      </Link>
      <PageHeader title="Übungen" description="Aktueller Stand und Entwicklung je Übung" />
      <QueryState query={stats} loading={<SkeletonList rows={6} className="h-16" />}>
        {(data) =>
          data.items.length === 0 ? (
            <div className="bg-surface rounded-tile">
              <EmptyState
                icon={TrendingUp}
                title="Noch keine Übungen"
                description="Sobald dein Athlet Trainings abschließt, siehst du hier die Entwicklung je Übung."
              />
            </div>
          ) : (
            <ExerciseStatsList
              data={data}
              href={(exerciseId) => `/coach/athletes/${id}/entwicklung/${exerciseId}`}
            />
          )
        }
      </QueryState>
    </>
  );
}
