import { History } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyWorkouts } from "@/features/workouts/api";
import { WorkoutList } from "@/features/workouts/workout-list";

export default function AthleteWorkoutsPage() {
  const [page, setPage] = useState(1);
  const workouts = useMyWorkouts(page);

  return (
    <>
      <PageHeader title="Verlauf" description="Deine bisherigen Trainings." />
      <QueryState query={workouts} loading={<SkeletonList rows={5} className="h-16" />}>
        {(data) =>
          data.total === 0 ? (
            <div className="bg-surface rounded-card">
              <EmptyState
                icon={History}
                title="Noch keine Trainings"
                description="Starte ein Training über deinen Plan, dann erscheint es hier."
                action={
                  <Link to="/plan" className="text-accent underline underline-offset-4">
                    Zum Trainingsplan
                  </Link>
                }
              />
            </div>
          ) : (
            <WorkoutList
              data={data}
              label="Trainings"
              href={(log) => `/workouts/${log.id}`}
              page={page}
              onPageChange={setPage}
              loading={workouts.isFetching}
              paginationPosition="top"
            />
          )
        }
      </QueryState>
    </>
  );
}
