import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useAthleteExerciseStats } from "@/features/stats/api";
import { ExerciseProgress } from "@/features/stats/exercise-progress";

export default function CoachExerciseProgressPage() {
  const { id = "", exerciseId = "" } = useParams();
  const stats = useAthleteExerciseStats(id, exerciseId);

  return (
    <>
      <Link
        to={`/coach/athletes/${id}`}
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Zum Athleten
      </Link>
      <QueryState query={stats} loading={<SkeletonList rows={3} className="h-40" />}>
        {(data) => (
          <>
            <PageHeader title={data.exerciseName} description="Verlauf des Athleten" />
            <ExerciseProgress
              data={data}
              logHref={(logId) => `/coach/athletes/${id}/workouts/${logId}`}
            />
          </>
        )}
      </QueryState>
    </>
  );
}
