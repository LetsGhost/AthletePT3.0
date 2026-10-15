import { ArrowLeft, SearchX } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { useMyWorkout } from "@/features/workouts/api";
import { formatLongDate } from "@/features/workouts/format";
import { WorkoutEditor } from "@/features/workouts/workout-editor";
import { WorkoutStatusBadge } from "@/features/workouts/workout-status-badge";
import { WorkoutView } from "@/features/workouts/workout-view";
import { ApiError } from "@/lib/http";

export default function AthleteWorkoutPage() {
  const { logId = "" } = useParams();
  const workout = useMyWorkout(logId);
  // Nach einem Konflikt neu laden und den Editor mit dem Serverstand neu aufbauen.
  const [reloads, setReloads] = useState(0);

  if (workout.error instanceof ApiError && workout.error.status === 404) {
    return (
      <div className="bg-surface rounded-card">
        <title>Training · AthletePT</title>
        <EmptyState
          icon={SearchX}
          title="Training nicht gefunden"
          description="Vielleicht wurde es verworfen."
          action={
            <Link to="/dashboard" className="text-accent underline underline-offset-4">
              Zur Übersicht
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <>
      <Link
        to="/workouts"
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Verlauf
      </Link>
      <QueryState query={workout} loading={<SkeletonList rows={4} className="h-40" />}>
        {(log) => (
          <>
            <PageHeader
              title={log.dayName}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  {formatLongDate(log.date)} <PlanTypeBadge type={log.dayType} />
                  <WorkoutStatusBadge status={log.status} />
                </span>
              }
            />
            {log.editable && log.status !== "skipped" ? (
              <WorkoutEditor
                key={`${log.id}-${log.status}-${reloads}`}
                log={log}
                onReload={() => void workout.refetch().then(() => setReloads((n) => n + 1))}
              />
            ) : (
              <WorkoutView log={log} />
            )}
          </>
        )}
      </QueryState>
    </>
  );
}
