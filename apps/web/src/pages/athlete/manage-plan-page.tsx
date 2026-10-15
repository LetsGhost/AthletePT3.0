import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useSession } from "@/features/auth/session";
import { usePlan } from "@/features/plans/api";
import { PlanDetail } from "@/features/plans/plan-detail";

/** Eigenen Plan bearbeiten (Berechtigung „Eigener Trainingsplan“, sonst zeigt die API 403). */
export default function ManagePlanPage() {
  const { planId = "" } = useParams();
  const user = useSession((state) => state.user);
  const plan = usePlan(user?.id ?? "", planId);

  return (
    <>
      <Link
        to="/plan"
        className="text-muted hover:text-text mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Training
      </Link>
      <QueryState query={plan} loading={<SkeletonList rows={3} className="h-40" />}>
        {(data) => <PlanDetail plan={data} athleteName={user?.name ?? ""} />}
      </QueryState>
    </>
  );
}
