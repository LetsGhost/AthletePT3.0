import { ArrowLeft, SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyExerciseStats } from "@/features/stats/api";
import { ExerciseProgress } from "@/features/stats/exercise-progress";
import { ApiError } from "@/lib/http";

export default function AthleteExerciseProgressPage() {
  const { exerciseId = "" } = useParams();
  const stats = useMyExerciseStats(exerciseId);

  return (
    <>
      <Link
        to="/entwicklung"
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Entwicklung
      </Link>
      {stats.error instanceof ApiError && stats.error.status === 404 ? (
        <div className="bg-surface rounded-card">
          <title>Entwicklung · AthletePT</title>
          <EmptyState
            icon={SearchX}
            title="Keine Daten zu dieser Übung"
            description="Sobald du sie in einem Training abschließt, erscheint hier ihr Verlauf."
          />
        </div>
      ) : (
        <QueryState query={stats} loading={<SkeletonList rows={3} className="h-40" />}>
          {(data) => (
            <>
              <PageHeader title={data.exerciseName} description="Dein Verlauf" />
              <ExerciseProgress data={data} logHref={(logId) => `/workouts/${logId}`} />
            </>
          )}
        </QueryState>
      )}
    </>
  );
}
