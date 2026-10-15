import type { Plan } from "@athletept/shared";
import { Archive, Copy, History, Play, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import { formatDateTime } from "@/lib/format";
import { ApiError, errorMessage } from "@/lib/http";

import {
  useActivatePlan,
  useArchivePlan,
  useDeletePlan,
  usePlan,
  usePlanVersion,
  usePlanVersions,
  useUpdatePlan,
} from "./api";
import { DuplicatePlanDialog, NewTemplateDialog } from "./plan-dialogs";
import { PlanEditor } from "./plan-editor";
import { PlanTypeBadge } from "./plan-type-badge";
import { PlanView } from "./plan-view";
import { PlanStatusBadge } from "./plans-card";
import { plansHomePath, usePlanViewer } from "./viewer";

type Confirm = "activate" | "archive" | "delete" | "duplicate" | "template" | null;

function Versions({ plan }: { plan: Plan }) {
  const versions = usePlanVersions(plan.athleteId, plan.id);
  const [revision, setRevision] = useState<number | null>(null);
  const version = usePlanVersion(plan.athleteId, plan.id, revision);

  return (
    <section
      aria-labelledby="plan-versions"
      className="bg-surface flex flex-col gap-2 rounded-tile p-4"
    >
      <h2 id="plan-versions" className="flex items-center gap-2 font-medium">
        <History aria-hidden="true" className="text-module-week size-4" /> Frühere Versionen
      </h2>
      <div>
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
      </div>
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
    </section>
  );
}

/**
 * Plan bearbeiten, aktivieren, archivieren, duplizieren. Für den Coach und für Athleten mit der
 * Berechtigung „Eigener Trainingsplan“; nur Texte und Vorlagen unterscheiden sich.
 */
export function PlanDetail({ plan, athleteName }: { plan: Plan; athleteName: string }) {
  const navigate = useNavigate();
  const viewer = usePlanViewer();
  const isCoach = viewer === "coach";
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

  let hint: string;
  if (plan.status === "archived") hint = "archiviert, nur lesbar";
  else if (plan.status === "active")
    hint = isCoach
      ? `Änderungen sieht ${athleteName} sofort nach dem Speichern`
      : "Änderungen gelten sofort nach dem Speichern für dein Training";
  else
    hint = isCoach
      ? `Entwurf, ${athleteName} sieht den Plan erst nach dem Aktivieren`
      : "Entwurf, aktiviere den Plan, um danach zu trainieren";
  const owner = isCoach
    ? `für ${athleteName}${plan.createdBy === "athlete" ? ", selbst erstellt" : ""}`
    : plan.createdBy === "coach"
      ? "von deinem Coach"
      : null;

  return (
    <>
      <PageHeader
        title={plan.name}
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <PlanStatusBadge status={plan.status} />
            <PlanTypeBadge type={plan.type} />
            <span>{owner ? `${owner} · ${hint}` : hint}</span>
          </span>
        }
        actions={
          <>
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
            <Button variant="secondary" disabled={dirty} onClick={() => setConfirm("duplicate")}>
              <Copy aria-hidden="true" className="size-4" /> Duplizieren
            </Button>
            {isCoach && (
              <Button variant="secondary" disabled={dirty} onClick={() => setConfirm("template")}>
                <Save aria-hidden="true" className="size-4" /> Als Vorlage
              </Button>
            )}
            {plan.status === "active" && (
              <Button
                variant="secondary"
                size="icon"
                aria-label="Archivieren"
                title="Archivieren"
                disabled={dirty}
                onClick={() => setConfirm("archive")}
              >
                <Archive aria-hidden="true" className="size-4" />
              </Button>
            )}
            {plan.status === "draft" && (
              <Button
                variant="ghost"
                size="icon"
                className="text-danger"
                aria-label="Entwurf löschen"
                title="Entwurf löschen"
                onClick={() => setConfirm("delete")}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            )}
          </>
        }
      />

      {dirty && (
        <p id="activate-hint" className="text-muted -mt-3 mb-4 text-sm">
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

      {plan.status === "archived" ? (
        <div className="flex flex-col gap-4">
          <Alert variant="info">
            Archivierte Pläne sind schreibgeschützt. Dupliziere den Plan, um darauf aufzubauen.
          </Alert>
          <PlanView content={plan} />
          <Versions plan={plan} />
        </div>
      ) : (
        <PlanEditor
          key={`${plan.id}-${plan.revision}`}
          content={plan}
          onSave={(values) => update.mutateAsync(values)}
          onReload={() => void planQuery.refetch()}
          onDirtyChange={setDirty}
          canCreateExercises={isCoach}
          aside={plan.status !== "draft" && <Versions plan={plan} />}
        />
      )}

      <ConfirmDialog
        open={confirm === "activate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`„${plan.name}“ aktivieren?`}
        description={
          isCoach
            ? `${athleteName} sieht den Plan sofort. Ein bisher aktiver Plan wird archiviert.`
            : "Du trainierst ab sofort nach diesem Plan. Ein bisher aktiver Plan wird archiviert."
        }
        confirmLabel="Aktivieren"
        loading={activate.isPending}
        onConfirm={run(() => activate.mutateAsync(), "Plan aktiviert.")}
      />
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`„${plan.name}“ archivieren?`}
        description={
          isCoach
            ? `${athleteName} sieht den Plan danach nicht mehr. Er bleibt für dich erhalten.`
            : "Der Plan verschwindet aus deinem Training, bleibt hier aber erhalten."
        }
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
          navigate(plansHomePath(viewer, plan.athleteId), { replace: true });
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
