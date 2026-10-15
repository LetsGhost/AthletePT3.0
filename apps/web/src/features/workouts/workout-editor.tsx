import { MAX_EXERCISE_SETS, type WorkoutExercise, type WorkoutLog } from "@athletept/shared";
import {
  AlertTriangle,
  Check,
  CloudOff,
  History,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { inputClasses } from "@/components/ui/input-classes";
import { formatRest, formatSetGroup, formatTarget, groupSets } from "@/features/plans/format";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { errorMessage } from "@/lib/http";

import { useCompleteWorkout, useDeleteWorkout } from "./api";
import {
  appendSet,
  draftFromLog,
  draftStorage,
  draftToRequest,
  fieldKey,
  openSetCount,
  type DraftExercise,
  type DraftSet,
  type WorkoutDraft,
} from "./draft";
import { formatLongDate, formatPerformedSets, formatWeekdayDate } from "./format";
import { RatingInput } from "./rating-input";
import type { DashboardState } from "./new-records";
import { useWorkoutAutosave, type SaveState } from "./use-autosave";

/** Lokaler Entwurf, wenn er auf dem aktuellen Serverstand aufbaut; sonst der Serverstand. */
function initialDraft(log: WorkoutLog): WorkoutDraft {
  const stored = draftStorage.read(log.id);
  if (stored && stored.revision === log.revision) return stored.draft;
  if (stored) draftStorage.remove(log.id);
  return draftFromLog(log);
}

const saveStateText: Record<SaveState, string> = {
  saved: "Alles gespeichert",
  pending: "Änderungen werden gleich gespeichert",
  saving: "Wird gespeichert …",
  offline: "Offline: auf dem Gerät gesichert, wird gesendet, sobald du wieder Netz hast",
  invalid: "Bitte die markierten Felder korrigieren",
  conflict: "Das Training wurde an anderer Stelle geändert",
  error: "Speichern fehlgeschlagen, neuer Versuch läuft",
};

function SaveIndicator({ state }: { state: SaveState }) {
  const Icon =
    state === "saved"
      ? Check
      : state === "saving" || state === "pending"
        ? Loader2
        : state === "offline"
          ? CloudOff
          : AlertTriangle;
  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-1.5 text-sm",
        state === "invalid" || state === "conflict" || state === "error"
          ? "text-danger"
          : "text-muted",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-4 shrink-0", state === "saving" && "animate-spin")}
      />
      {saveStateText[state]}
    </p>
  );
}

interface SetRowProps {
  index: number;
  set: DraftSet;
  target: WorkoutExercise["targets"][number] | undefined;
  exerciseName: string;
  timed: boolean;
  errors: Record<string, string>;
  errorKey: (field: "weight" | "reps" | "duration") => string;
  disabled: boolean;
  onChange: (set: DraftSet) => void;
}

function SetRow({
  index,
  set,
  target,
  exerciseName,
  timed,
  errors,
  errorKey,
  disabled,
  onChange,
}: SetRowProps) {
  const label = `Satz ${index + 1}`;
  const amountField = timed ? "duration" : "reps";
  const weightError = errors[errorKey("weight")];
  const amountError = errors[errorKey(amountField)];
  const targetText = target
    ? [
        formatTarget(target),
        target.weightKg !== null ? `${formatNumber(target.weightKg)} kg` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Zusatzsatz";
  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_4.5rem_4rem_2.75rem] items-center gap-2 rounded-card px-2 py-1.5",
        set.done && "bg-inset",
      )}
    >
      <span className="min-w-0 text-sm">
        <span className="block font-medium">
          {label}
          {target?.kind === "warmup" && (
            <span className="text-muted font-normal"> · Aufwärmen</span>
          )}
        </span>
        <span className="text-muted block truncate">{targetText}</span>
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`${exerciseName}, ${label}: Gewicht in kg`}
        aria-invalid={weightError ? true : undefined}
        title={weightError}
        className={cn(inputClasses, "px-2 text-center tabular-nums")}
        value={set.weight}
        placeholder="kg"
        disabled={disabled}
        onChange={(e) => onChange({ ...set, weight: e.target.value })}
      />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${exerciseName}, ${label}: ${timed ? "Dauer in Sekunden" : "Wiederholungen"}`}
        aria-invalid={amountError ? true : undefined}
        title={amountError}
        className={cn(inputClasses, "px-2 text-center tabular-nums")}
        value={timed ? set.duration : set.reps}
        placeholder={timed ? "s" : "Wdh."}
        disabled={disabled}
        onChange={(e) =>
          onChange(timed ? { ...set, duration: e.target.value } : { ...set, reps: e.target.value })
        }
      />
      <label className="flex size-11 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          className="accent-primary size-6"
          checked={set.done}
          disabled={disabled}
          aria-label={`${exerciseName}, ${label} erledigt`}
          onChange={(e) => onChange({ ...set, done: e.target.checked })}
        />
      </label>
      {(weightError || amountError) && (
        <p className="text-danger col-span-4 text-sm">
          {label}: {weightError ?? amountError}
        </p>
      )}
    </li>
  );
}

interface ExerciseCardProps {
  index: number;
  exercise: WorkoutExercise;
  draft: DraftExercise;
  errors: Record<string, string>;
  onChange: (draft: DraftExercise) => void;
}

function ExerciseCard({ index, exercise, draft, errors, onChange }: ExerciseCardProps) {
  const timed = exercise.targets.some((t) => t.durationSeconds !== null);
  const headingId = `exercise-${exercise.id}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "bg-surface flex flex-col gap-3 rounded-card p-3",
        draft.skipped && "opacity-80",
      )}
    >
      <div className="flex items-start gap-2">
        <h2 id={headingId} className="min-w-0 flex-1 font-medium">
          <span className="text-muted tabular-nums">{index + 1}. </span>
          {exercise.exerciseName}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={draft.skipped}
          onClick={() => onChange({ ...draft, skipped: !draft.skipped })}
        >
          {draft.skipped ? "Doch machen" : "Auslassen"}
        </Button>
      </div>

      {exercise.targets.length > 0 && (
        <p className="text-sm">
          <span className="text-muted">Vorgabe: </span>
          {groupSets(exercise.targets)
            .map((g) =>
              g.kind === "warmup" ? `Aufwärmen ${formatSetGroup(g)}` : formatSetGroup(g),
            )
            .join(", ")}
        </p>
      )}
      {(exercise.restSeconds !== null || exercise.planNotes) && (
        <div className="text-muted flex flex-col gap-1 text-sm">
          {exercise.restSeconds !== null && (
            <p className="flex items-center gap-1">
              <Timer aria-hidden="true" className="size-4" /> {formatRest(exercise.restSeconds)}
            </p>
          )}
          {exercise.planNotes && <p className="whitespace-pre-line">{exercise.planNotes}</p>}
        </div>
      )}
      {exercise.previous && (
        <p className="flex items-start gap-1.5 text-sm">
          <History aria-hidden="true" className="text-muted mt-0.5 size-4 shrink-0" />
          <span>
            <span className="text-muted">
              Letztes Mal ({formatWeekdayDate(exercise.previous.date)}):{" "}
            </span>
            {formatPerformedSets(exercise.previous.sets)}
          </span>
        </p>
      )}

      {draft.skipped ? (
        <p className="text-muted text-sm">Ausgelassen.</p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="text-muted grid grid-cols-[minmax(0,1fr)_4.5rem_4rem_2.75rem] gap-2 px-2 text-xs"
          >
            <span />
            <span className="text-center">kg</span>
            <span className="text-center">{timed ? "Sek." : "Wdh."}</span>
            <span className="text-center">Erledigt</span>
          </div>
          <ol className="-mx-2 flex flex-col gap-1">
            {draft.sets.map((set, s) => (
              <SetRow
                key={s}
                index={s}
                set={set}
                target={exercise.targets[s]}
                exerciseName={exercise.exerciseName}
                timed={timed}
                errors={errors}
                errorKey={(field) => fieldKey(index, s, field)}
                disabled={false}
                onChange={(next) =>
                  onChange({ ...draft, sets: draft.sets.map((x, i) => (i === s ? next : x)) })
                }
              />
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={draft.sets.length >= MAX_EXERCISE_SETS}
              onClick={() => onChange(appendSet(draft))}
            >
              <Plus aria-hidden="true" className="size-4" /> Satz
            </Button>
            {draft.sets.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...draft, sets: draft.sets.slice(0, -1) })}
              >
                <Minus aria-hidden="true" className="size-4" /> Letzten Satz entfernen
              </Button>
            )}
          </div>
        </>
      )}
      <details className="group" open={draft.notes !== "" || undefined}>
        <summary className="text-accent min-h-11 cursor-pointer content-center text-sm underline-offset-4 hover:underline">
          Notiz zur Übung
        </summary>
        <TextareaField
          label={`Notiz zu ${exercise.exerciseName}`}
          rows={2}
          maxLength={500}
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
        />
      </details>
    </section>
  );
}

/** Training durchführen bzw. korrigieren. Speichert automatisch. */
export function WorkoutEditor({ log, onReload }: { log: WorkoutLog; onReload: () => void }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => initialDraft(log));
  const running = log.status === "in_progress";
  const autosave = useWorkoutAutosave(log, draft, true);
  const complete = useCompleteWorkout(log.id);
  const discard = useDeleteWorkout();
  const [confirm, setConfirm] = useState<"complete" | "discard" | null>(null);
  const { errors } = draftToRequest(draft, log.revision);
  const open = openSetCount(draft);

  const updateExercise = (index: number, next: DraftExercise) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((x, i) => (i === index ? next : x)) }));

  const handleComplete = async () => {
    const { body, errors: invalid } = await autosave.flush();
    if (Object.keys(invalid).length > 0) {
      setConfirm(null);
      toast("Bitte erst die markierten Felder korrigieren.", "error");
      return;
    }
    try {
      const { newRecords } = await complete.mutateAsync(body);
      autosave.clear();
      toast(
        newRecords.length > 0
          ? "Training abgeschlossen, mit neuem Bestwert!"
          : "Training abgeschlossen. Stark!",
      );
      navigate("/dashboard", { state: { newRecords } satisfies DashboardState });
    } catch (error) {
      toast(errorMessage(error), "error");
      setConfirm(null);
    }
  };

  const handleDiscard = async () => {
    autosave.clear();
    try {
      await autosave.flush();
      await discard.mutateAsync(log.id);
      toast("Training verworfen.");
      navigate(`/plan/${log.dayId}`, { replace: true });
    } catch (error) {
      toast(errorMessage(error), "error");
      setConfirm(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface sticky top-0 z-10 -mx-4 px-4 py-2 sm:static sm:mx-0 sm:rounded-card">
        <SaveIndicator state={autosave.state} />
      </div>
      {autosave.state === "conflict" && (
        <Alert variant="error" title="Neuerer Stand vorhanden">
          <p>
            Das Training wurde inzwischen auf einem anderen Gerät geändert. Lade den neuen Stand;
            deine Änderungen hier gehen dabei verloren.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              draftStorage.remove(log.id);
              onReload();
            }}
          >
            <RotateCcw aria-hidden="true" className="size-4" /> Neu laden
          </Button>
        </Alert>
      )}
      {!running && log.editableUntil && (
        <Alert variant="info">
          Abgeschlossen. Du kannst Korrekturen bis {formatDateTime(log.editableUntil)} speichern.
        </Alert>
      )}

      {log.exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id}
          index={index}
          exercise={exercise}
          draft={draft.exercises[index]!}
          errors={errors}
          onChange={(next) => updateExercise(index, next)}
        />
      ))}

      <Card>
        <CardHeader title={running ? "Abschluss" : "Bewertung und Kommentar"} />
        <CardBody className="flex flex-col gap-4">
          <RatingInput
            value={draft.rating}
            onChange={(rating) => setDraft((d) => ({ ...d, rating }))}
          />
          <TextareaField
            label="Kommentar für deinen Coach"
            hint="Wie lief es? Schmerzen, Schlaf, Besonderheiten."
            maxLength={2000}
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
          {running && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" className="text-danger" onClick={() => setConfirm("discard")}>
                <Trash2 aria-hidden="true" className="size-4" /> Verwerfen
              </Button>
              <Button size="lg" onClick={() => setConfirm("complete")}>
                <Check aria-hidden="true" className="size-5" /> Training abschließen
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirm === "complete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Training abschließen?"
        description={
          open > 0
            ? `${open} ${open === 1 ? "Satz ist" : "Sätze sind"} nicht abgehakt und ${open === 1 ? "zählt" : "zählen"} nicht als geschafft.`
            : `${log.dayName} am ${formatLongDate(log.date)} wird an deinen Coach übermittelt.`
        }
        confirmLabel="Abschließen"
        loading={complete.isPending}
        onConfirm={() => void handleComplete()}
      />
      <ConfirmDialog
        open={confirm === "discard"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Training verwerfen?"
        description="Alle Eingaben zu diesem Training werden gelöscht."
        confirmLabel="Verwerfen"
        destructive
        loading={discard.isPending}
        onConfirm={() => void handleDiscard()}
      />
    </div>
  );
}
