import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useAthlete } from "@/features/athletes/api";
import { usePlan } from "@/features/plans/api";
import { PlanDetail } from "@/features/plans/plan-detail";

export default function PlanPage() {
  const { id = "", planId = "" } = useParams();
  const athlete = useAthlete(id);
  const plan = usePlan(id, planId);
  const athleteName = athlete.data?.name ?? "der Athlet";

  return (
    <>
      <Link
        to={`/coach/athletes/${id}`}
        className="text-muted hover:text-text mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> {athlete.data?.name ?? "Athlet"}
      </Link>
      <QueryState query={plan} loading={<SkeletonList rows={3} className="h-40" />}>
        {(data) => <PlanDetail plan={data} athleteName={athleteName} />}
      </QueryState>
    </>
  );
}
