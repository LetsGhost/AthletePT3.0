import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { useAthleteWorkout } from "@/features/workouts/api";
import { formatLongDate } from "@/features/workouts/format";
import { WorkoutStatusBadge } from "@/features/workouts/workout-status-badge";
import { WorkoutView } from "@/features/workouts/workout-view";
import { formatDateTime } from "@/lib/format";

export default function CoachWorkoutPage() {
  const { id = "", logId = "" } = useParams();
  const workout = useAthleteWorkout(id, logId);

  return (
    <>
      <Link
        to={`/coach/athletes/${id}`}
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Zum Athleten
      </Link>
      <QueryState query={workout} loading={<SkeletonList rows={4} className="h-32" />}>
        {(log) => (
          <>
            <PageHeader
              title={log.dayName}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  {formatLongDate(log.date)} <PlanTypeBadge type={log.dayType} />
                  <WorkoutStatusBadge status={log.status} />
                  {log.completedAt && (
                    <span className="text-sm">
                      {log.status === "skipped" ? "abgesagt" : "abgeschlossen"} am{" "}
                      {formatDateTime(log.completedAt)}
                    </span>
                  )}
                </span>
              }
            />
            <WorkoutView log={log} />
          </>
        )}
      </QueryState>
    </>
  );
}
