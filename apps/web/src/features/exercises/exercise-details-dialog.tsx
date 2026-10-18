import { equipmentLabels, exerciseCategoryLabels, type Exercise } from "@athletept/shared";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { Dialog } from "@/components/ui/dialog";

import { muscleList } from "./labels";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** Was der Dialog anzeigt. Synonyme und Herkunft fehlen z. B. in der Planansicht der Athleten. */
export type ExerciseDetails = Pick<
  Exercise,
  | "name"
  | "category"
  | "equipment"
  | "primaryMuscles"
  | "secondaryMuscles"
  | "description"
  | "executionNotes"
  | "videoUrl"
> &
  Partial<Pick<Exercise, "aliases" | "scope">>;

/** Nur lesen, z. B. globale Übungen für Coaches oder Übungen im Plan für Athleten. */
export function ExerciseDetailsDialog({
  exercise,
  onOpenChange,
}: {
  exercise: ExerciseDetails;
  onOpenChange: (open: boolean) => void;
}) {
  const origin = {
    global: "Aus dem Übungskatalog",
    own: "Eigene Übung",
    private: "Private Übung",
  } as const;
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={exercise.name}
      description={exercise.scope ? origin[exercise.scope] : undefined}
    >
      <dl className="flex flex-col gap-4">
        <Row label="Kategorie und Equipment">
          {exerciseCategoryLabels[exercise.category]} · {equipmentLabels[exercise.equipment]}
        </Row>
        <Row label="Primäre Muskelgruppen">{muscleList(exercise.primaryMuscles)}</Row>
        {exercise.secondaryMuscles.length > 0 && (
          <Row label="Sekundäre Muskelgruppen">{muscleList(exercise.secondaryMuscles)}</Row>
        )}
        {exercise.aliases && exercise.aliases.length > 0 && (
          <Row label="Synonyme">{exercise.aliases.join(", ")}</Row>
        )}
        {exercise.description && <Row label="Beschreibung">{exercise.description}</Row>}
        {exercise.executionNotes && (
          <Row label="Ausführungshinweise">{exercise.executionNotes}</Row>
        )}
        {exercise.videoUrl && (
          <Row label="Video">
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent inline-flex items-center gap-1 break-all underline underline-offset-4"
            >
              Video ansehen
              <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
          </Row>
        )}
      </dl>
    </Dialog>
  );
}
