import { planStatusLabels, type PlanStatus, type PlanSummary } from "@athletept/shared";
import { ChevronRight, Dumbbell, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { formatDate } from "@/lib/format";

import { usePlans } from "./api";
import { NewPlanDialog } from "./plan-dialogs";
import { PlanTypeBadge } from "./plan-type-badge";
import { planPath, usePlanViewer, type PlanViewer } from "./viewer";

const statusTone: Record<PlanStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  draft: "warning",
  archived: "neutral",
};

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return <Badge tone={statusTone[status]}>{planStatusLabels[status]}</Badge>;
}

/** Zeigt an, wenn der Plan von der jeweils anderen Seite stammt. */
const creatorLabel: Record<PlanViewer, string> = { coach: "vom Athleten", athlete: "vom Coach" };

function PlanItem({
  athleteId,
  plan,
  viewer,
}: {
  athleteId: string;
  plan: PlanSummary;
  viewer: PlanViewer;
}) {
  const date =
    plan.status === "active" && plan.activatedAt
      ? `aktiv seit ${formatDate(plan.activatedAt)}`
      : plan.status === "archived" && plan.archivedAt
        ? `archiviert am ${formatDate(plan.archivedAt)}`
        : `geändert am ${formatDate(plan.updatedAt)}`;
  return (
    <li>
      <Link
        to={planPath(viewer, athleteId, plan.id)}
        className="bg-inset hover:border-border-strong flex items-center gap-3 rounded-card border border-transparent p-3 transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{plan.name}</span>
            <PlanStatusBadge status={plan.status} />
            <PlanTypeBadge type={plan.type} />
            {plan.createdBy !== viewer && <Badge tone="neutral">{creatorLabel[viewer]}</Badge>}
          </span>
          <span className="text-muted block text-sm">
            {plan.dayCount} {plan.dayCount === 1 ? "Trainingstag" : "Trainingstage"} · {date}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-muted size-5 shrink-0" />
      </Link>
    </li>
  );
}

/**
 * Pläne eines Athleten: für den Coach auf der Detailseite des Athleten, für den Athleten mit
 * der Berechtigung „Eigener Trainingsplan“ auf seiner Trainingsseite.
 */
export function PlansCard({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const viewer = usePlanViewer();
  const plans = usePlans(athleteId);
  const [creating, setCreating] = useState(false);

  return (
    <Card>
      <CardHeader
        title={viewer === "athlete" ? "Meine Trainingspläne" : "Trainingspläne"}
        icon={Dumbbell}
        iconClassName="text-module-records"
        action={
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" /> Neuer Plan
          </Button>
        }
      />
      <CardBody>
        <QueryState query={plans} loading={<SkeletonList rows={2} className="h-16" />}>
          {({ items }) =>
            items.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="Noch kein Trainingsplan"
                description={
                  viewer === "athlete"
                    ? "Lege einen Plan an und aktiviere ihn, um danach zu trainieren."
                    : `Lege einen Plan an und aktiviere ihn, damit ${athleteName} ihn sieht.`
                }
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus aria-hidden="true" className="size-4" /> Ersten Plan anlegen
                  </Button>
                }
              />
            ) : (
              <ul
                className="flex flex-col gap-2"
                aria-label={
                  viewer === "athlete"
                    ? "Meine Trainingspläne"
                    : `Trainingspläne von ${athleteName}`
                }
              >
                {items.map((plan) => (
                  <PlanItem key={plan.id} athleteId={athleteId} plan={plan} viewer={viewer} />
                ))}
              </ul>
            )
          }
        </QueryState>
      </CardBody>
      {creating && <NewPlanDialog athleteId={athleteId} open onOpenChange={setCreating} />}
    </Card>
  );
}
