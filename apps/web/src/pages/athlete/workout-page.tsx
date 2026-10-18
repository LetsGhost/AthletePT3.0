import type { CompleteWorkoutResponse } from "@athletept/shared";
import { ArrowLeft, SearchX } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { useMyWorkout } from "@/features/workouts/api";
import { formatClock, formatLongDate } from "@/features/workouts/format";
import { useElapsedSeconds } from "@/features/workouts/use-elapsed-seconds";
import { WorkoutEditor } from "@/features/workouts/workout-editor";
import { WorkoutSummary } from "@/features/workouts/workout-summary";
import { WorkoutStatusBadge } from "@/features/workouts/workout-status-badge";
import { WorkoutView } from "@/features/workouts/workout-view";
import { ApiError } from "@/lib/http";

/** Laufende Trainingsdauer neben der Überschrift. */
function ElapsedTime({ since }: { since: string }) {
  const seconds = useElapsedSeconds(since, true);
  return (
    <p className="bg-surface flex h-9 items-center gap-2 rounded-full px-3 text-sm tabular-nums">
      <span aria-hidden="true" className="bg-success size-2 animate-pulse rounded-full" />
      <span className="sr-only">Trainingsdauer </span>
      {formatClock(seconds)}
    </p>
  );
}

export default function AthleteWorkoutPage() {
  const { logId = "" } = useParams();
  const workout = useMyWorkout(logId);
  // Nach einem Konflikt neu laden und den Editor mit dem Serverstand neu aufbauen.
  const [reloads, setReloads] = useState(0);
  const [completed, setCompleted] = useState<CompleteWorkoutResponse | null>(null);

  if (completed?.id === logId) {
    return <WorkoutSummary log={completed} onEdit={() => setCompleted(null)} />;
  }

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
              actions={log.status === "in_progress" && <ElapsedTime since={log.startedAt} />}
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
                onCompleted={setCompleted}
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
