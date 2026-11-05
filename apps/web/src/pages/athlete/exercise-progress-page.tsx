import { ArrowLeft, SearchX } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyExerciseStats } from "@/features/stats/api";
import { ExerciseProgress } from "@/features/stats/exercise-progress";
import { sessionsText } from "@/features/stats/format";
import { ApiError } from "@/lib/http";

export default function AthleteExerciseProgressPage() {
  const { exerciseId = "" } = useParams();
  const [hideDeviating, setHideDeviating] = useState(false);
  const stats = useMyExerciseStats(exerciseId, hideDeviating);

  return (
    <>
      <Link
        to="/fortschritt/uebungen"
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Übungen
      </Link>
      {stats.error instanceof ApiError && stats.error.status === 404 ? (
        <div className="bg-surface rounded-card">
          <title>Fortschritt · AthletePT</title>
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
              <PageHeader title={data.exerciseName} description={sessionsText(data)} />
              <ExerciseProgress
                data={data}
                hideDeviating={hideDeviating}
                onHideDeviatingChange={setHideDeviating}
                logHref={(logId) => `/workouts/${logId}`}
              />
            </>
          )}
        </QueryState>
      )}
    </>
  );
}
