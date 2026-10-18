import {
  equipmentLabels,
  exerciseCategoryLabels,
  type OwnedExercise,
  type OwnedExerciseListResponse,
} from "@athletept/shared";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { ArrowUpFromLine, Eye, Inbox, Replace } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import { errorMessage } from "@/lib/http";

import { ExerciseDetailsDialog } from "./exercise-details-dialog";
import { muscleSummary } from "./labels";
import { ReplaceExerciseDialog } from "./replace-exercise-dialog";

interface OwnedExerciseListProps {
  query: UseQueryResult<OwnedExerciseListResponse>;
  /** Übernehmen in den eigenen (Coach) bzw. globalen Katalog (Sysadmin). */
  take: UseMutationResult<unknown, Error, string>;
  /** „von Anna“ bzw. „von Coach Clara“ */
  ownerLabel: (exercise: OwnedExercise) => string;
  /** Erklärung über der Liste. */
  intro: string;
  /** Meldung nach dem Übernehmen. */
  takenMessage: (name: string) => string;
  /** Erklärung im Ersetzen-Dialog, was mit Plänen und Trainings passiert. */
  replaceConsequence: (exercise: OwnedExercise) => string;
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * Übungen anderer, die der Anfragende prüfen und in seinen Katalog übernehmen kann: private
 * Übungen der Athleten (Coach) oder vorgeschlagene Coach-Übungen (Sysadmin).
 */
export function OwnedExerciseList({
  query,
  take,
  ownerLabel,
  intro,
  takenMessage,
  replaceConsequence,
  emptyTitle,
  emptyDescription,
}: OwnedExerciseListProps) {
  const [showing, setShowing] = useState<OwnedExercise | null>(null);
  const [replacing, setReplacing] = useState<OwnedExercise | null>(null);

  const run = async (exercise: OwnedExercise) => {
    try {
      await take.mutateAsync(exercise.id);
      toast(takenMessage(exercise.name));
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <QueryState query={query} loading={<SkeletonList rows={3} />}>
      {({ items }) =>
        items.length === 0 ? (
          <Card>
            <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted text-sm">{intro}</p>
            <ul className="flex flex-col gap-2" aria-label="Zu prüfende Übungen">
              {items.map((exercise) => (
                <li key={exercise.id}>
                  <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{exercise.name}</p>
                      <p className="text-muted text-sm">
                        {ownerLabel(exercise)} · {exerciseCategoryLabels[exercise.category]} ·{" "}
                        {equipmentLabels[exercise.equipment]}
                      </p>
                      <p className="text-sm">{muscleSummary(exercise)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${exercise.name} ansehen`}
                        onClick={() => setShowing(exercise)}
                      >
                        <Eye aria-hidden="true" className="size-4" /> Details
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={take.isPending && take.variables === exercise.id}
                        aria-label={`${exercise.name} übernehmen`}
                        onClick={() => void run(exercise)}
                      >
                        <ArrowUpFromLine aria-hidden="true" className="size-4" /> Übernehmen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${exercise.name} ersetzen`}
                        onClick={() => setReplacing(exercise)}
                      >
                        <Replace aria-hidden="true" className="size-4" /> Ersetzen
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            {replacing && (
              <ReplaceExerciseDialog
                exercise={replacing}
                consequence={replaceConsequence(replacing)}
                onOpenChange={(open) => !open && setReplacing(null)}
              />
            )}
            {showing && (
              <ExerciseDetailsDialog
                exercise={showing}
                onOpenChange={(open) => !open && setShowing(null)}
              />
            )}
          </div>
        )
      }
    </QueryState>
  );
}
