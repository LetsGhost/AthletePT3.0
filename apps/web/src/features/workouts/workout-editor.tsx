import {
  MAX_CUSTOM_WORKOUT_EXERCISES,
  type CompleteWorkoutResponse,
  type WorkoutLog,
} from "@athletept/shared";
import { AlertTriangle, Check, CloudOff, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/http";

import { AddExerciseDialog } from "./add-exercise-dialog";
import { useCompleteWorkout, useDeleteWorkout } from "./api";
import {
  customExerciseView,
  draftFromLog,
  draftStorage,
  draftToRequest,
  isExerciseComplete,
  openSetCount,
  setProgress,
  type DraftExercise,
  type WorkoutDraft,
} from "./draft";
import { ExerciseCard } from "./exercise-card";
import { formatLongDate } from "./format";
import { RatingInput } from "./rating-input";
import { unlockAlarm } from "./rest-timer/alarm";
import { useRestSettings } from "./rest-timer/rest-settings";
import { RestTimerBar } from "./rest-timer/rest-timer-bar";
import { useRestTimer } from "./rest-timer/use-rest-timer";
import { useWakeLock } from "./rest-timer/use-wake-lock";
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
  rejected: "Speichern nicht möglich",
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
        state === "invalid" || state === "conflict" || state === "rejected" || state === "error"
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

/** Fortschritt und Speicherstatus, am Handy unter der Kopfzeile angeheftet. */
function WorkoutProgress({ draft, state }: { draft: WorkoutDraft; state: SaveState }) {
  const { done, total } = setProgress(draft);
  return (
    <div className="bg-bg/90 sticky top-16 z-10 -mx-4 flex flex-col gap-2 px-4 py-2 backdrop-blur lg:top-0 lg:mx-0 lg:px-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{done}</span> von {total} Sätzen
        </p>
        <SaveIndicator state={state} />
      </div>
      <div
        role="progressbar"
        aria-label="Erledigte Sätze"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="bg-inset h-1.5 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: total ? `${(done / total) * 100}%` : 0 }}
        />
      </div>
    </div>
  );
}

/** Zu Beginn eines laufenden Trainings nur die erste offene Übung aufklappen, sonst alle. */
function initialOpen(log: WorkoutLog, draft: WorkoutDraft): ReadonlySet<string> {
  if (log.status !== "in_progress") return new Set(draft.exercises.map((x) => x.id));
  const first = draft.exercises.find((x) => !x.skipped && !isExerciseComplete(x));
  return new Set(first ? [first.id] : []);
}

/** Nächste offene Übung nach `index`, notfalls wieder von vorn. */
function nextOpenExercise(exercises: DraftExercise[], index: number) {
  const order = [...exercises.slice(index + 1), ...exercises.slice(0, index)];
  return order.find((x) => !x.skipped && !isExerciseComplete(x));
}

interface WorkoutEditorProps {
  log: WorkoutLog;
  onReload: () => void;
  onCompleted: (result: CompleteWorkoutResponse) => void;
}

/** Training durchführen bzw. korrigieren. Speichert automatisch. */
export function WorkoutEditor({ log, onReload, onCompleted }: WorkoutEditorProps) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => initialDraft(log));
  const [openIds, setOpenIds] = useState(() => initialOpen(log, draft));
  const running = log.status === "in_progress";
  const autosave = useWorkoutAutosave(log, draft, true);
  const rest = useRestTimer(log.id);
  const restSettings = useRestSettings();
  const showRest = running && restSettings.enabled;
  const complete = useCompleteWorkout(log.id);
  const discard = useDeleteWorkout();
  const [confirm, setConfirm] = useState<"complete" | "discard" | null>(null);
  const [adding, setAdding] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const { errors } = draftToRequest(draft, log.revision);
  // Plan-Übungen vom Server, spontane aus dem Entwurf (auch solange noch nicht gespeichert).
  const views = useMemo(() => {
    const byId = new Map(log.exercises.map((x) => [x.id, x]));
    return draft.exercises.map((x) =>
      x.custom ? customExerciseView(x.id, x.custom) : byId.get(x.id)!,
    );
  }, [log.exercises, draft.exercises]);
  const customCount = draft.exercises.filter((x) => x.custom).length;
  const open = openSetCount(draft);
  useWakeLock(running);

  const toggleOpen = (id: string) =>
    setOpenIds((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const updateExercise = (index: number, next: DraftExercise) => {
    const previous = draft.exercises[index]!;
    const exercises = draft.exercises.map((x, i) => (i === index ? next : x));
    setDraft((d) => ({ ...d, exercises: d.exercises.map((x, i) => (i === index ? next : x)) }));
    if (!running) return;

    const exercise = views[index]!;
    const checked = next.sets.some((set, i) => set.done && !previous.sets[i]?.done);
    // Vorgabe des Coaches vor eigener Standardpause; 0 heißt bewusst keine Pause.
    const restSeconds = exercise.restSeconds ?? restSettings.defaultSeconds;
    if (checked && restSettings.enabled && restSeconds > 0) {
      unlockAlarm();
      rest.start(exercise.id, exercise.exerciseName, restSeconds);
    }

    // Fertig oder ausgelassen: zuklappen und mit der nächsten offenen Übung weitermachen.
    if ((checked && isExerciseComplete(next)) || (next.skipped && !previous.skipped)) {
      const following = nextOpenExercise(exercises, index);
      setOpenIds((ids) => {
        const nextIds = new Set(ids);
        nextIds.delete(next.id);
        if (following) nextIds.add(following.id);
        return nextIds;
      });
    } else if (previous.skipped && !next.skipped) {
      setOpenIds((ids) => new Set(ids).add(next.id));
    }
  };

  const addExercise = (exercise: DraftExercise) => {
    setDraft((d) => ({ ...d, exercises: [...d.exercises, exercise] }));
    setOpenIds((ids) => new Set(ids).add(exercise.id));
  };

  const removeExercise = (id: string) => {
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== id) }));
    setRemoveId(null);
  };

  const handleComplete = async () => {
    const { body, errors: invalid } = await autosave.flush();
    if (Object.keys(invalid).length > 0) {
      setConfirm(null);
      toast("Bitte erst die markierten Felder korrigieren.", "error");
      return;
    }
    try {
      const result = await complete.mutateAsync(body);
      autosave.clear();
      rest.stop();
      onCompleted(result);
    } catch (error) {
      toast(errorMessage(error), "error");
      setConfirm(null);
    }
  };

  const handleDiscard = async () => {
    autosave.clear();
    rest.stop();
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
    <div className="flex flex-col gap-3">
      <WorkoutProgress draft={draft} state={autosave.state} />
      {(autosave.state === "conflict" || autosave.state === "rejected") && (
        <Alert
          variant="error"
          title={
            autosave.state === "conflict" ? "Neuerer Stand vorhanden" : "Speichern nicht möglich"
          }
        >
          <p>
            {autosave.state === "conflict"
              ? "Das Training wurde inzwischen auf einem anderen Gerät geändert."
              : "Der Server nimmt die Änderungen nicht mehr an, z. B. weil das Training gesperrt oder gelöscht ist."}{" "}
            Lade den neuen Stand; deine Änderungen hier gehen dabei verloren.
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

      {draft.exercises.map((exerciseDraft, index) => (
        <ExerciseCard
          key={exerciseDraft.id}
          index={index}
          exercise={views[index]!}
          draft={exerciseDraft}
          errors={errors}
          open={openIds.has(exerciseDraft.id)}
          onToggleOpen={() => toggleOpen(exerciseDraft.id)}
          onChange={(next) => updateExercise(index, next)}
          onRemove={
            exerciseDraft.custom
              ? () =>
                  exerciseDraft.sets.some((s) => s.done)
                    ? setRemoveId(exerciseDraft.id)
                    : removeExercise(exerciseDraft.id)
              : undefined
          }
        />
      ))}

      <button
        type="button"
        disabled={customCount >= MAX_CUSTOM_WORKOUT_EXERCISES}
        onClick={() => setAdding(true)}
        className="border-border-strong text-accent hover:border-accent flex min-h-15 items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed px-4 py-2.5 disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="bg-accent/12 flex size-8 items-center justify-center rounded-lg">
          <Plus aria-hidden="true" className="size-5" strokeWidth={2.4} />
        </span>
        <span className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <span className="font-semibold">Übung hinzufügen</span>
          <span className="text-muted text-xs">
            {customCount >= MAX_CUSTOM_WORKOUT_EXERCISES
              ? `Höchstens ${MAX_CUSTOM_WORKOUT_EXERCISES} zusätzliche Übungen`
              : "Nur für dieses Training, z. B. zum Ausprobieren"}
          </span>
        </span>
      </button>
      <AddExerciseDialog open={adding} onOpenChange={setAdding} onAdd={addExercise} />

      <Card className="mt-2">
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

      {showRest && (
        <>
          {/* Platz, damit der Pausen-Timer am Seitenende nichts verdeckt. */}
          {rest.timer && <div aria-hidden="true" className="h-24 lg:hidden" />}
          <RestTimerBar rest={rest} />
        </>
      )}

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
        open={removeId !== null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Übung entfernen?"
        description="Die abgehakten Sätze dieser Übung werden mit entfernt."
        confirmLabel="Entfernen"
        destructive
        onConfirm={() => removeId && removeExercise(removeId)}
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
