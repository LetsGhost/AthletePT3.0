import { MAX_REPLACE_REASON_LENGTH, type Exercise, type OwnedExercise } from "@athletept/shared";
import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { errorMessage } from "@/lib/http";

import { useReplaceExercise } from "./api";
import { ExercisePicker } from "./exercise-picker";
import { muscleSummary } from "./labels";

interface ReplaceExerciseDialogProps {
  exercise: OwnedExercise;
  /** Was mit Plänen und Trainings passiert, z. B. „Pläne und Trainings von Anna …“. */
  consequence: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Ersetzt eine Übung durch eine Katalogübung. Die Begründung sieht der bisherige Besitzer im
 * Hinweis, deshalb lohnt sie sich, wenn nicht offensichtlich ist, warum ersetzt wurde.
 */
export function ReplaceExerciseDialog({
  exercise,
  consequence,
  onOpenChange,
}: ReplaceExerciseDialogProps) {
  const replace = useReplaceExercise();
  const [target, setTarget] = useState<Exercise | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target) {
      setError("Wähle die Übung, die stattdessen verwendet werden soll.");
      return;
    }
    setError(null);
    try {
      await replace.mutateAsync({ id: exercise.id, targetId: target.id, reason });
      toast(`„${exercise.name}“ durch „${target.name}“ ersetzt.`);
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={`„${exercise.name}“ ersetzen`}
      description={consequence}
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        {target ? (
          <div className="bg-inset flex items-center justify-between gap-2 rounded-card p-3">
            <span className="min-w-0">
              <span className="text-muted block text-sm">Ersetzen durch</span>
              <span className="block font-medium">{target.name}</span>
              <span className="text-muted block text-sm">{muscleSummary(target)}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
              Ändern
            </Button>
          </div>
        ) : (
          <ExercisePicker
            label="Ersetzen durch"
            placeholder="Übung aus dem Katalog suchen"
            onSelect={setTarget}
          />
        )}
        <TextareaField
          label="Begründung"
          hint="Optional. Sieht der bisherige Besitzer im Hinweis, z. B. „Das ist unsere Kniebeuge“."
          maxLength={MAX_REPLACE_REASON_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={replace.isPending}>
            Ersetzen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
