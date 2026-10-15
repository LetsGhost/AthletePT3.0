import { ArrowLeft, CalendarX } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyPlan } from "@/features/plans/api";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { weekdayLabel } from "@/features/plans/format";
import { DayContent } from "@/features/plans/plan-view";
import { useMyWeek } from "@/features/workouts/api";
import { DayActions } from "@/features/workouts/day-actions";

export default function AthletePlanDayPage() {
  const { dayId = "" } = useParams();
  const myPlan = useMyPlan();
  const week = useMyWeek();

  return (
    <>
      <Link
        to="/plan"
        className="text-muted hover:text-text mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Training
      </Link>
      <QueryState query={myPlan} loading={<SkeletonList rows={4} className="h-24" />}>
        {({ plan }) => {
          const day = plan?.days.find((d) => d.id === dayId);
          if (!plan || !day) {
            return (
              <div className="bg-surface rounded-card">
                <title>Trainingstag · AthletePT</title>
                <EmptyState
                  icon={CalendarX}
                  title="Trainingstag nicht gefunden"
                  description="Vielleicht hat dein Coach den Plan inzwischen geändert."
                  action={
                    <Link to="/plan" className="text-accent underline underline-offset-4">
                      Zum aktuellen Plan
                    </Link>
                  }
                />
              </div>
            );
          }
          return (
            <>
              <PageHeader
                title={day.name}
                description={
                  <span className="flex flex-wrap items-center gap-2">
                    {weekdayLabel(day.weekday)} <PlanTypeBadge type={day.type} />
                  </span>
                }
              />
              <div className="mb-4">
                <QueryState query={week} loading={<div className="skeleton h-36 rounded-card" />}>
                  {(data) => <DayActions day={day} week={data} />}
                </QueryState>
              </div>
              <div className="bg-surface rounded-card p-4">
                <DayContent day={day} exercises={plan.exercises} level="h2" />
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
