import type { Plan } from "@athletept/shared";
import { Archive, ArrowLeft, Copy, History, Play, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import { useAthlete } from "@/features/athletes/api";
import {
  useActivatePlan,
  useArchivePlan,
  useDeletePlan,
  usePlan,
  usePlanVersion,
  usePlanVersions,
  useUpdatePlan,
} from "@/features/plans/api";
import { DuplicatePlanDialog, NewTemplateDialog } from "@/features/plans/plan-dialogs";
import { PlanEditor } from "@/features/plans/plan-editor";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { PlanView } from "@/features/plans/plan-view";
import { PlanStatusBadge } from "@/features/plans/plans-card";
import { formatDateTime } from "@/lib/format";
import { ApiError, errorMessage } from "@/lib/http";

type Confirm = "activate" | "archive" | "delete" | "duplicate" | "template" | null;

function Versions({ plan }: { plan: Plan }) {
  const versions = usePlanVersions(plan.athleteId, plan.id);
  const [revision, setRevision] = useState<number | null>(null);
  const version = usePlanVersion(plan.athleteId, plan.id, revision);

  return (
    <Card>
      <CardHeader title="Frühere Versionen" icon={History} iconClassName="text-module-week" />
      <CardBody>
        <QueryState query={versions} loading={<SkeletonList rows={2} className="h-10" />}>
          {({ items }) =>
            items.length === 0 ? (
              <p className="text-muted text-sm">
                Noch keine. Sobald du den aktiven Plan änderst, bleibt der vorherige Stand hier
                erhalten.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.revision} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted">
                        {" "}
                        · gültig bis {formatDateTime(item.replacedAt)}
                      </span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setRevision(item.revision)}>
                      Ansehen
                    </Button>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryState>
      </CardBody>
      {revision !== null && (
        <Dialog
          open
          onOpenChange={(open) => !open && setRevision(null)}
          title="Frühere Version"
          description={
            version.data ? `Gültig bis ${formatDateTime(version.data.replacedAt)}` : undefined
          }
        >
          <QueryState query={version} loading={<SkeletonList rows={3} />}>
            {(data) => (
              <>
                <p className="mb-3 font-medium">{data.name}</p>
                <PlanView content={data} />
              </>
            )}
          </QueryState>
        </Dialog>
      )}
    </Card>
  );
}

function PlanDetail({ plan, athleteName }: { plan: Plan; athleteName: string }) {
  const navigate = useNavigate();
  const planQuery = usePlan(plan.athleteId, plan.id);
  const update = useUpdatePlan(plan.athleteId, plan.id);
  const activate = useActivatePlan(plan.athleteId, plan.id);
  const archive = useArchivePlan(plan.athleteId, plan.id);
  const remove = useDeletePlan(plan.athleteId, plan.id);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [actionError, setActionError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

  const run = (action: () => Promise<unknown>, success: string) => () => {
    setActionError(null);
    void action()
      .then(() => toast(success))
      .catch((error: unknown) =>
        setActionError({
          message: errorMessage(error),
          details: error instanceof ApiError ? error.errors.map((e) => e.message) : [],
        }),
      )
      .finally(() => setConfirm(null));
  };

  return (
    <>
      <PageHeader
        title={plan.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PlanStatusBadge status={plan.status} />
            <PlanTypeBadge type={plan.type} />
            <span>für {athleteName}</span>
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {plan.status !== "active" && (
          <Button
            disabled={dirty}
            onClick={() => setConfirm("activate")}
            aria-describedby={dirty ? "activate-hint" : undefined}
          >
            <Play aria-hidden="true" className="size-4" />
            {plan.status === "archived" ? "Wieder aktivieren" : "Aktivieren"}
          </Button>
        )}
        {plan.status !== "archived" && plan.status !== "draft" && (
          <Button variant="secondary" disabled={dirty} onClick={() => setConfirm("archive")}>
            <Archive aria-hidden="true" className="size-4" /> Archivieren
          </Button>
        )}
        <Button variant="secondary" disabled={dirty} onClick={() => setConfirm("duplicate")}>
          <Copy aria-hidden="true" className="size-4" /> Duplizieren
        </Button>
        <Button variant="secondary" disabled={dirty} onClick={() => setConfirm("template")}>
          <Save aria-hidden="true" className="size-4" /> Als Vorlage speichern
        </Button>
        {plan.status === "draft" && (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirm("delete")}>
            <Trash2 aria-hidden="true" className="size-4" /> Entwurf löschen
          </Button>
        )}
      </div>
      {dirty && (
        <p id="activate-hint" className="text-muted -mt-2 mb-4 text-sm">
          Speichere zuerst deine Änderungen, um den Plan zu aktivieren, zu kopieren oder zu
          archivieren.
        </p>
      )}
      {actionError && (
        <Alert variant="error" title={actionError.message} className="mb-4">
          {actionError.details.length > 0 && (
            <ul className="list-disc pl-5">
              {actionError.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        {plan.status === "archived" ? (
          <>
            <Alert variant="info">
              Archivierte Pläne sind schreibgeschützt. Dupliziere den Plan, um darauf aufzubauen.
            </Alert>
            <PlanView content={plan} />
          </>
        ) : (
          <PlanEditor
            key={`${plan.id}-${plan.revision}`}
            content={plan}
            onSave={(values) => update.mutateAsync(values)}
            onReload={() => void planQuery.refetch()}
            onDirtyChange={setDirty}
            notice={
              plan.status === "active" ? (
                <Alert variant="info">
                  Dieser Plan ist aktiv. Gespeicherte Änderungen sieht {athleteName} sofort, der
                  vorherige Stand bleibt als Version erhalten.
                </Alert>
              ) : (
                <Alert variant="info">
                  Entwurf: {athleteName} sieht den Plan erst, wenn du ihn aktivierst.
                </Alert>
              )
            }
          />
        )}
        {plan.status !== "draft" && <Versions plan={plan} />}
      </div>

      <ConfirmDialog
        open={confirm === "activate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`„${plan.name}“ aktivieren?`}
        description={`${athleteName} sieht den Plan sofort. Ein bisher aktiver Plan wird archiviert.`}
        confirmLabel="Aktivieren"
        loading={activate.isPending}
        onConfirm={run(() => activate.mutateAsync(), "Plan aktiviert.")}
      />
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`„${plan.name}“ archivieren?`}
        description={`${athleteName} sieht den Plan danach nicht mehr. Er bleibt für dich erhalten.`}
        confirmLabel="Archivieren"
        loading={archive.isPending}
        onConfirm={run(() => archive.mutateAsync(), "Plan archiviert.")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Entwurf „${plan.name}“ löschen?`}
        description="Der Entwurf wird endgültig gelöscht."
        confirmLabel="Löschen"
        destructive
        loading={remove.isPending}
        onConfirm={run(async () => {
          await remove.mutateAsync();
          navigate(`/coach/athletes/${plan.athleteId}`, { replace: true });
        }, "Entwurf gelöscht.")}
      />
      {confirm === "duplicate" && (
        <DuplicatePlanDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          source={plan}
          athleteId={plan.athleteId}
        />
      )}
      {confirm === "template" && (
        <NewTemplateDialog open onOpenChange={(open) => !open && setConfirm(null)} source={plan} />
      )}
    </>
  );
}

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
