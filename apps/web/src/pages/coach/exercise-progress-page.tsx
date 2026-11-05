import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useAthleteExerciseStats } from "@/features/stats/api";
import { ExerciseProgress } from "@/features/stats/exercise-progress";
import { sessionsText } from "@/features/stats/format";

export default function CoachExerciseProgressPage() {
  const { id = "", exerciseId = "" } = useParams();
  const [hideDeviating, setHideDeviating] = useState(false);
  const stats = useAthleteExerciseStats(id, exerciseId, hideDeviating);

  return (
    <>
      <Link
        to={`/coach/athletes/${id}/entwicklung`}
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Übungen
      </Link>
      <QueryState query={stats} loading={<SkeletonList rows={3} className="h-40" />}>
        {(data) => (
          <>
            <PageHeader title={data.exerciseName} description={sessionsText(data)} />
            <ExerciseProgress
              data={data}
              hideDeviating={hideDeviating}
              onHideDeviatingChange={setHideDeviating}
              logHref={(logId) => `/coach/athletes/${id}/workouts/${logId}`}
            />
          </>
        )}
      </QueryState>
    </>
  );
}
