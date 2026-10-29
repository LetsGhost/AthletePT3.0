import { MAX_EXERCISE_SETS, type WorkoutExercise } from "@athletept/shared";
import { Check, ChevronDown, History, Minus, NotebookPen, Plus, Timer, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { TextareaField } from "@/components/ui/textarea-field";
import { formatRest, formatSetGroup, formatTarget, groupSets } from "@/features/plans/format";
import { Switch } from "@/features/settings/settings-parts";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

import {
  appendSet,
  fieldKey,
  isExerciseComplete,
  type DraftExercise,
  type DraftSet,
} from "./draft";
import { DeviatingBadge } from "./deviating-badge";
import { formatPerformedSets, formatWeekdayDate } from "./format";

const rowGrid = "grid grid-cols-[2rem_minmax(0,1fr)_4.25rem_3.75rem_2.75rem] items-center gap-2";

interface SetLabel {
  /** In der Tabelle: „W“ für Aufwärmsätze, sonst die Nummer des Arbeitssatzes. */
  short: string;
  /** Für Screenreader und Fehlermeldungen: „Aufwärmsatz“, „Satz 2“. */
  name: string;
  warmup: boolean;
}

/** Aufwärmsätze zählen extra, Arbeits- und Zusatzsätze werden ab 1 durchnummeriert. */
function setLabels(targets: WorkoutExercise["targets"], count: number): SetLabel[] {
  const warmups = targets.slice(0, count).filter((t) => t.kind === "warmup").length;
  let warmup = 0;
  let working = 0;
  return Array.from({ length: count }, (_, s) => {
    if (targets[s]?.kind === "warmup") {
      warmup += 1;
      return {
        short: "W",
        name: warmups > 1 ? `Aufwärmsatz ${warmup}` : "Aufwärmsatz",
        warmup: true,
      };
    }
    working += 1;
    return { short: String(working), name: `Satz ${working}`, warmup: false };
  });
}

interface SetRowProps {
  set: DraftSet;
  label: SetLabel;
  target: WorkoutExercise["targets"][number] | undefined;
  exerciseName: string;
  timed: boolean;
  errors: Record<string, string>;
  errorKey: (field: "weight" | "reps" | "duration") => string;
  onChange: (set: DraftSet) => void;
}

function SetRow({
  set,
  label,
  target,
  exerciseName,
  timed,
  errors,
  errorKey,
  onChange,
}: SetRowProps) {
  const amountField = timed ? "duration" : "reps";
  const weightError = errors[errorKey("weight")];
  const amountError = errors[errorKey(amountField)];
  const targetText = target
    ? [
        formatTarget(target),
        target.weightKg !== null ? `${formatNumber(target.weightKg)} kg` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Frei"
    : "Zusatzsatz";
  const tag = label.warmup ? "Aufwärmen" : target ? null : "Extra";
  return (
    <li className={cn(rowGrid, "rounded-card px-2 py-1.5", set.done && "bg-primary/10")}>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-sm font-medium tabular-nums",
          set.done
            ? "bg-primary text-on-primary"
            : label.warmup
              ? "bg-warning/15 text-warning"
              : "bg-inset",
        )}
      >
        {label.short}
      </span>
      <span className="min-w-0 text-sm leading-tight">
        <span className="sr-only">{label.name}: </span>
        <span className="block">{targetText}</span>
        {tag && <span className="text-muted block text-xs">{tag}</span>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`${exerciseName}, ${label.name}: Gewicht in kg`}
        aria-invalid={weightError ? true : undefined}
        title={weightError}
        className={cn(inputClasses, "px-2 text-center tabular-nums")}
        value={set.weight}
        placeholder="kg"
        onChange={(e) => onChange({ ...set, weight: e.target.value })}
      />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${exerciseName}, ${label.name}: ${timed ? "Dauer in Sekunden" : "Wiederholungen"}`}
        aria-invalid={amountError ? true : undefined}
        title={amountError}
        className={cn(inputClasses, "px-2 text-center tabular-nums")}
        value={timed ? set.duration : set.reps}
        placeholder={timed ? "s" : "Wdh."}
        onChange={(e) =>
          onChange(timed ? { ...set, duration: e.target.value } : { ...set, reps: e.target.value })
        }
      />
      <label
        className={cn(
          "flex size-11 cursor-pointer items-center justify-center rounded-card border",
          "has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2",
          set.done ? "bg-primary border-primary text-on-primary" : "bg-inset border-border-strong",
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={set.done}
          aria-label={`${exerciseName}, ${label.name} erledigt`}
          onChange={(e) => onChange({ ...set, done: e.target.checked })}
        />
        {set.done && <Check aria-hidden="true" className="size-5" strokeWidth={3} />}
      </label>
      {(weightError || amountError) && (
        <p className="text-danger col-span-5 text-sm">
          {label.name}: {weightError ?? amountError}
        </p>
      )}
    </li>
  );
}

interface DeviatingFieldsProps {
  exerciseName: string;
  draft: DraftExercise;
  switchId: string;
  onChange: (draft: DraftExercise) => void;
}

/** Schalter „Abweichend“ und Notiz zur Übung; die Notiz dient auch als Begründung. */
function DeviatingFields({ exerciseName, draft, switchId, onChange }: DeviatingFieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Switch
          checked={draft.deviating}
          labelledBy={switchId}
          onChange={(deviating) => onChange({ ...draft, deviating })}
        />
        <span id={switchId} className="text-muted text-sm font-medium">
          Abweichend (anderes Gerät/Gym)
        </span>
      </div>
      <TextareaField
        label={`Notiz zu ${exerciseName}`}
        rows={2}
        maxLength={500}
        placeholder={
          draft.deviating ? "Was war anders? (optional)" : "z. B. Griff enger, Schulter ok"
        }
        value={draft.notes}
        onChange={(e) => onChange({ ...draft, notes: e.target.value })}
      />
    </div>
  );
}

interface ExerciseCardProps {
  index: number;
  exercise: WorkoutExercise;
  draft: DraftExercise;
  errors: Record<string, string>;
  open: boolean;
  onToggleOpen: () => void;
  onChange: (draft: DraftExercise) => void;
  /** Nur bei spontanen Übungen: statt Auslassen ganz entfernen. */
  onRemove?: () => void;
}

/** Eine Übung als aufklappbare Karte: Kopf mit Vorgabe und Status, darunter die Sätze. */
export function ExerciseCard({
  index,
  exercise,
  draft,
  errors,
  open,
  onToggleOpen,
  onChange,
  onRemove,
}: ExerciseCardProps) {
  const id = useId();
  const nameId = `${id}-name`;
  const bodyId = `${id}-body`;
  const deviatingId = `${id}-deviating`;
  const [noteOpen, setNoteOpen] = useState(draft.notes !== "" || draft.deviating);
  const timed = exercise.targets.some((t) => t.durationSeconds !== null);
  const complete = isExerciseComplete(draft);
  const done = draft.sets.filter((s) => s.done).length;
  const expanded = open && !draft.skipped;
  const labels = setLabels(exercise.targets, draft.sets.length);
  const chips = [
    ...(exercise.custom ? ["Spontan hinzugefügt"] : []),
    ...groupSets(exercise.targets).map((g) =>
      g.kind === "warmup" ? `Aufwärmen ${formatSetGroup(g)}` : formatSetGroup(g),
    ),
  ];

  return (
    <section
      aria-labelledby={nameId}
      className={cn("bg-surface rounded-card", draft.skipped && "opacity-70")}
    >
      <h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          disabled={draft.skipped}
          onClick={onToggleOpen}
          className="flex min-h-11 w-full items-start gap-3 rounded-card p-3 text-left disabled:cursor-default"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums",
              complete && !draft.skipped ? "bg-primary text-on-primary" : "bg-inset",
            )}
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span id={nameId} className="font-medium">
                {exercise.exerciseName}
              </span>
              {draft.deviating && <DeviatingBadge />}
            </span>
            {chips.length > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="bg-inset text-muted rounded-full px-2 py-0.5 text-xs font-normal"
                  >
                    {chip}
                  </span>
                ))}
              </span>
            )}
          </span>
          {!draft.skipped && (
            <span className="flex shrink-0 items-center gap-1 text-sm">
              <span className={cn("tabular-nums", complete ? "text-accent" : "text-muted")}>
                {complete ? "Fertig" : `${done}/${draft.sets.length}`}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn("text-muted size-5 transition-transform", expanded && "rotate-180")}
              />
            </span>
          )}
        </button>
      </h2>

      {draft.skipped && (
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <span className="text-muted text-sm">Ausgelassen</span>
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...draft, skipped: false })}>
            Doch machen
          </Button>
        </div>
      )}

      {expanded && (
        <div id={bodyId} className="flex flex-col gap-3 px-3 pb-3">
          {(exercise.restSeconds !== null || exercise.previous || exercise.planNotes) && (
            <div className="text-muted flex flex-col gap-1 text-sm">
              {exercise.restSeconds !== null && (
                <p className="flex items-center gap-1.5">
                  <Timer aria-hidden="true" className="size-4 shrink-0" />
                  {formatRest(exercise.restSeconds)}
                </p>
              )}
              {exercise.previous && (
                <p className="flex items-start gap-1.5">
                  <History aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Letztes Mal ({formatWeekdayDate(exercise.previous.date)}):{" "}
                    <span className="text-text">{formatPerformedSets(exercise.previous.sets)}</span>
                    {draft.deviating && (
                      <span className="block text-xs italic">
                        Werte vom letzten normalen Training – evtl. nicht vergleichbar
                      </span>
                    )}
                  </span>
                </p>
              )}
              {exercise.planNotes && <p className="whitespace-pre-line">{exercise.planNotes}</p>}
            </div>
          )}

          {draft.sets.length > 0 && (
            <div>
              <div aria-hidden="true" className={cn(rowGrid, "text-muted px-2 pb-1 text-xs")}>
                <span className="text-center">Satz</span>
                <span>Vorgabe</span>
                <span className="text-center">kg</span>
                <span className="text-center">{timed ? "Sek." : "Wdh."}</span>
                <span className="text-center">
                  <Check className="mx-auto size-4" />
                </span>
              </div>
              <ol className="-mx-2 flex flex-col gap-1">
                {draft.sets.map((set, s) => (
                  <SetRow
                    key={s}
                    set={set}
                    label={labels[s]!}
                    target={exercise.targets[s]}
                    exerciseName={exercise.exerciseName}
                    timed={timed}
                    errors={errors}
                    errorKey={(field) => fieldKey(index, s, field)}
                    onChange={(next) =>
                      onChange({ ...draft, sets: draft.sets.map((x, i) => (i === s ? next : x)) })
                    }
                  />
                ))}
              </ol>
            </div>
          )}

          {noteOpen && (
            <DeviatingFields
              exerciseName={exercise.exerciseName}
              draft={draft}
              switchId={deviatingId}
              onChange={onChange}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={draft.sets.length >= MAX_EXERCISE_SETS}
              onClick={() => onChange(appendSet(draft))}
            >
              <Plus aria-hidden="true" className="size-4" /> Satz
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Letzten Satz entfernen"
              disabled={draft.sets.length === 0}
              onClick={() => onChange({ ...draft, sets: draft.sets.slice(0, -1) })}
            >
              <Minus aria-hidden="true" className="size-4" />
            </Button>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={noteOpen}
              onClick={() => setNoteOpen((o) => !o)}
            >
              <NotebookPen aria-hidden="true" className="size-4" />
              {noteOpen ? "Notiz ausblenden" : draft.notes ? "Notiz ✓" : "Notiz"}
            </Button>
            {onRemove ? (
              <Button variant="ghost" size="sm" className="text-danger" onClick={onRemove}>
                <Trash2 aria-hidden="true" className="size-4" /> Entfernen
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...draft, skipped: true })}
              >
                Auslassen
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
