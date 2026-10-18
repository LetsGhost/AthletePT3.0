import { Dumbbell } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyPermissions } from "@/features/athletes/api";
import { useSession } from "@/features/auth/session";
import { useMyPlan } from "@/features/plans/api";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { PlansCard } from "@/features/plans/plans-card";
import { useMyWeek } from "@/features/workouts/api";
import { findNextTraining } from "@/features/workouts/next-training";
import {
  NextTrainingCard,
  TrainingDayCard,
  WeekStrip,
} from "@/features/workouts/training-overview";

export default function AthletePlanPage() {
  const myPlan = useMyPlan();
  const week = useMyWeek();
  const user = useSession((state) => state.user);
  const ownPlan = useMyPermissions().data?.ownPlan ?? false;
  const plan = myPlan.data?.plan;

  return (
    <>
      <PageHeader
        title="Training"
        description={plan ? plan.name : "Dein aktueller Trainingsplan."}
        actions={plan && <PlanTypeBadge type={plan.type} />}
      />
      <QueryState query={myPlan} loading={<SkeletonList rows={4} className="h-20" />}>
        {({ plan }) =>
          !plan ? (
            <div className="bg-surface rounded-card">
              <EmptyState
                icon={Dumbbell}
                title="Noch kein Trainingsplan"
                description={
                  ownPlan
                    ? "Lege unten einen Plan an und aktiviere ihn, oder warte auf deinen Coach."
                    : "Sobald dein Coach einen Plan für dich freigibt, findest du ihn hier."
                }
              />
            </div>
          ) : (
            <QueryState query={week} loading={<SkeletonList rows={4} className="h-28" />}>
              {(data) => {
                const next = findNextTraining(plan.days, data);
                return (
                  <div className="flex flex-col gap-3.5">
                    {next && <NextTrainingCard next={next} week={data} />}
                    <WeekStrip days={plan.days} week={data} next={next} />
                    <div className="flex items-center justify-between px-0.5 pt-1">
                      <h2 className="font-semibold">Alle Trainingstage</h2>
                      <span className="text-muted text-xs">{plan.days.length} pro Woche</span>
                    </div>
                    <ul className="flex flex-col gap-2.5" aria-label="Trainingstage">
                      {plan.days.map((day) => (
                        <li key={day.id}>
                          <TrainingDayCard
                            day={day}
                            week={data}
                            isNext={next?.kind === "planned" && next.day.id === day.id}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }}
            </QueryState>
          )
        }
      </QueryState>
      {ownPlan && user && (
        <div className="mt-4">
          <PlansCard athleteId={user.id} athleteName={user.name} />
        </div>
      )}
    </>
  );
}
