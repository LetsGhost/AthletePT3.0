import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useTemplates } from "@/features/plans/api";
import { NewTemplateDialog } from "@/features/plans/plan-dialogs";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { formatDate } from "@/lib/format";

export default function TemplatesPage() {
  const templates = useTemplates();
  const [creating, setCreating] = useState(false);
  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden="true" className="size-4" /> Neue Vorlage
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Vorlagen"
        description="Wiederverwendbare Pläne. Daraus legst du auf der Seite eines Athleten neue Pläne an."
        actions={newButton}
      />
      <QueryState query={templates} loading={<SkeletonList rows={3} className="h-16" />}>
        {({ items }) =>
          items.length === 0 ? (
            <div className="bg-surface rounded-card">
              <EmptyState
                icon={ClipboardList}
                title="Noch keine Vorlagen"
                description="Lege eine Vorlage an oder speichere einen bestehenden Plan über „Als Vorlage speichern“."
                action={newButton}
              />
            </div>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Vorlagen">
              {items.map((template) => (
                <li key={template.id}>
                  <Link
                    to={`/coach/templates/${template.id}`}
                    className="bg-surface hover:bg-inset flex items-center gap-4 rounded-card p-4 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        <PlanTypeBadge type={template.type} />
                      </span>
                      <span className="text-muted block text-sm">
                        {template.dayCount}{" "}
                        {template.dayCount === 1 ? "Trainingstag" : "Trainingstage"} · geändert am{" "}
                        {formatDate(template.updatedAt)}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="text-muted size-5 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
      {creating && <NewTemplateDialog open onOpenChange={setCreating} />}
    </>
  );
}
