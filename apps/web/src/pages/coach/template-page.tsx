import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import { useDeleteTemplate, useTemplate, useUpdateTemplate } from "@/features/plans/api";
import { PlanEditor } from "@/features/plans/plan-editor";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { errorMessage } from "@/lib/http";

export default function TemplatePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const template = useTemplate(id);
  const update = useUpdateTemplate(id);
  const remove = useDeleteTemplate(id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Link
        to="/coach/templates"
        className="text-muted hover:text-text mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Vorlagen
      </Link>
      <QueryState query={template} loading={<SkeletonList rows={3} className="h-40" />}>
        {(data) => (
          <>
            <PageHeader
              title={data.name}
              description={
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <PlanTypeBadge type={data.type} />
                  <span>
                    Vorlage · Änderungen wirken sich nicht auf Pläne aus, die schon daraus
                    entstanden sind
                  </span>
                </span>
              }
              actions={
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 aria-hidden="true" className="size-4" /> Löschen
                </Button>
              }
            />
            <PlanEditor
              key={`${data.id}-${data.revision}`}
              content={data}
              onSave={(values) => update.mutateAsync(values)}
              onReload={() => void template.refetch()}
            />
            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title={`Vorlage „${data.name}“ löschen?`}
              description="Pläne, die du daraus angelegt hast, bleiben erhalten."
              confirmLabel="Löschen"
              destructive
              loading={remove.isPending}
              onConfirm={() =>
                void remove
                  .mutateAsync()
                  .then(() => {
                    toast("Vorlage gelöscht.");
                    navigate("/coach/templates", { replace: true });
                  })
                  .catch((error: unknown) => {
                    toast(errorMessage(error), "error");
                    setConfirmDelete(false);
                  })
              }
            />
          </>
        )}
      </QueryState>
    </>
  );
}
