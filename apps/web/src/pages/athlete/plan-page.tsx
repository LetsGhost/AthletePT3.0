import { ChevronRight, Dumbbell } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyPlan } from "@/features/plans/api";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { weekdayLabel } from "@/features/plans/format";

export default function AthletePlanPage() {
  const myPlan = useMyPlan();

  return (
    <>
      <PageHeader title="Training" description="Dein aktueller Trainingsplan." />
      <QueryState query={myPlan} loading={<SkeletonList rows={4} className="h-20" />}>
        {({ plan }) =>
          !plan ? (
            <div className="bg-surface rounded-card">
              <EmptyState
                icon={Dumbbell}
                title="Noch kein Trainingsplan"
                description="Sobald dein Coach einen Plan für dich freigibt, findest du ihn hier."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <section className="bg-surface rounded-card p-4" aria-labelledby="plan-name">
                <h2
                  id="plan-name"
                  className="flex flex-wrap items-center gap-2 text-lg font-medium"
                >
                  {plan.name}
                  <PlanTypeBadge type={plan.type} />
                </h2>
                {plan.notes && <p className="text-muted mt-2 whitespace-pre-line">{plan.notes}</p>}
              </section>
              <ul className="flex flex-col gap-2" aria-label="Trainingstage">
                {plan.days.map((day) => (
                  <li key={day.id}>
                    <Link
                      to={`/plan/${day.id}`}
                      className="bg-surface hover:bg-inset flex min-h-16 items-center gap-4 rounded-card p-4 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-muted block text-sm">
                          {weekdayLabel(day.weekday)}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{day.name}</span>
                          <PlanTypeBadge type={day.type} />
                        </span>
                        <span className="text-muted block text-sm">
                          {day.exercises.length} {day.exercises.length === 1 ? "Übung" : "Übungen"}
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" className="text-muted size-5 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      </QueryState>
    </>
  );
}
