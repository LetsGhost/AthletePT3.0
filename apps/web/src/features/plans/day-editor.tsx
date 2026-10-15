import {
  detectPlanType,
  MAX_DAY_EXERCISES,
  weekdayLabels,
  weekdays,
  type Exercise,
  type MuscleGroup,
} from "@athletept/shared";
import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Controller,
  get,
  useFieldArray,
  useFormContext,
  useWatch,
  type FieldError,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useExerciseSearch } from "@/features/exercises/api";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import { cn } from "@/lib/cn";

import { shortWeekday, typeInputs, type InfoMap } from "./editor-helpers";
import { emptySet, type EditorValues } from "./editor-values";
import { ExerciseEntryEditor } from "./exercise-entry-editor";
import { PlanTypeBadge } from "./plan-type-badge";
import { WarmupEditor } from "./warmup-editor";

interface DayEditorProps {
  index: number;
  count: number;
  infos: InfoMap;
  canDuplicate: boolean;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onPick: (exercise: Exercise) => void;
  onCreateExercise: ((name: string, onCreated: (exercise: Exercise) => void) => void) | undefined;
}

/** Ein Trainingstag: Name, Wochentag, Warm-up und die Übungen mit ihren Sätzen. */
export function DayEditor({
  index,
  count,
  infos,
  canDuplicate,
  onMove,
  onDuplicate,
  onRemove,
  onPick,
  onCreateExercise,
}: DayEditorProps) {
  const id = useId();
  const base = `days.${index}` as const;
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<EditorValues>();
  const exercises = useFieldArray({ control, name: `${base}.exercises`, keyName: "key" });
  const watched = useWatch({ control, name: base });
  const dayName = watched?.name?.trim() || `Tag ${index + 1}`;
  const error = (path: string) =>
    (get(errors, `${base}.${path}`) as FieldError | undefined)?.message;
  const exercisesError = error("exercises") ?? error("exercises.root");
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const first = exercises.fields[0]?.key;
    return first ? { [first]: true } : {};
  });

  const addExercise = (exercise: Exercise) => {
    onPick(exercise);
    exercises.append({ exerciseId: exercise.id, sets: [emptySet(), emptySet(), emptySet()] });
  };
  // Neu hinzugefügte Übungen gleich aufklappen.
  const knownKeys = useRef(new Set(exercises.fields.map((field) => field.key)));
  useEffect(() => {
    const added = exercises.fields.filter((field) => !knownKeys.current.has(field.key));
    knownKeys.current = new Set(exercises.fields.map((field) => field.key));
    if (added.length > 0) {
      setOpen((current) => ({
        ...current,
        ...Object.fromEntries(added.map((field) => [field.key, true])),
      }));
    }
  }, [exercises.fields]);
  const setAll = (value: boolean) =>
    setOpen(Object.fromEntries(exercises.fields.map((field) => [field.key, value])));

  const usedIds = (watched?.exercises ?? []).map((entry) => entry.exerciseId);
  const topMuscle = mostFrequentMuscle(
    usedIds.flatMap((exerciseId) => {
      const info = exerciseId ? infos[exerciseId] : undefined;
      return info ? info.primaryMuscles : [];
    }),
  );

  return (
    <div className="flex flex-col gap-3.5">
      <section
        aria-label={`Einstellungen für ${dayName}`}
        className="bg-surface flex flex-col gap-3.5 rounded-tile p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="text-muted shrink-0 text-sm">Tag {index + 1}</span>
            <input
              autoComplete="off"
              aria-label="Name des Tages"
              aria-invalid={error("name") ? true : undefined}
              aria-describedby={error("name") ? `${id}-name-error` : undefined}
              placeholder="z. B. Oberkörper A"
              className={cn(
                "h-10 min-w-30 flex-1 rounded-card border border-transparent bg-transparent px-2 text-xl font-medium",
                "hover:border-border-strong focus-visible:border-accent placeholder:text-muted",
                "aria-[invalid=true]:border-danger",
              )}
              {...register(`${base}.name`)}
            />
            <PlanTypeBadge
              type={detectPlanType(typeInputs(watched?.exercises, infos))}
              className="shrink-0"
            />
          </div>
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted size-10"
              aria-label={`${dayName} nach vorne`}
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted size-10"
              aria-label={`${dayName} nach hinten`}
              disabled={index === count - 1}
              onClick={() => onMove(index + 1)}
            >
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted size-10"
              aria-label={`${dayName} duplizieren`}
              disabled={!canDuplicate}
              onClick={onDuplicate}
            >
              <Copy aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-danger size-10"
              aria-label={`${dayName} entfernen`}
              onClick={onRemove}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
        {error("name") && (
          <p id={`${id}-name-error`} className="text-danger -mt-2 text-sm">
            {error("name")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <span id={`${id}-weekday`} className="text-muted w-20 text-sm">
            Wochentag
          </span>
          <Controller
            control={control}
            name={`${base}.weekday`}
            render={({ field }) => (
              <div
                role="group"
                aria-labelledby={`${id}-weekday`}
                className="flex flex-wrap gap-1.5"
              >
                {weekdays.map((day) => {
                  const selected = field.value === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      aria-label={weekdayLabels[day]}
                      onClick={() => field.onChange(selected ? null : day)}
                      className={cn(
                        "h-9 w-11 rounded-card border text-sm font-medium transition-colors",
                        selected
                          ? "bg-primary text-on-primary border-primary"
                          : "bg-inset border-border hover:border-border-strong",
                      )}
                    >
                      {shortWeekday(day)}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {!watched?.weekday && <span className="text-muted text-xs">Flexibel</span>}
        </div>

        <WarmupEditor base={base} infos={infos} dayName={dayName} onPick={onPick} />
      </section>

      <div className="flex items-center justify-between px-1 pt-1">
        <h2 className="font-medium">
          Übungen <span className="text-muted font-normal">· {exercises.fields.length}</span>
        </h2>
        {exercises.fields.length > 0 && (
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted text-xs"
              onClick={() => setAll(true)}
            >
              Alle aufklappen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted text-xs"
              onClick={() => setAll(false)}
            >
              Alle zuklappen
            </Button>
          </div>
        )}
      </div>
      {exercisesError && <p className="text-danger text-sm">{exercisesError}</p>}

      {exercises.fields.length === 0 ? (
        <div className="text-muted border-border-strong/60 rounded-tile border-[1.5px] border-dashed p-7 text-center text-sm">
          Noch keine Übungen an diesem Tag. Such unten eine Übung aus der Bibliothek.
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {exercises.fields.map((field, e) => (
            <li key={field.key}>
              <ExerciseEntryEditor
                dayIndex={index}
                index={e}
                count={exercises.fields.length}
                info={infos[field.exerciseId]}
                open={Boolean(open[field.key]) || Boolean(get(errors, `${base}.exercises.${e}`))}
                onToggle={() =>
                  setOpen((current) => ({ ...current, [field.key]: !current[field.key] }))
                }
                onMove={(to) => exercises.move(e, to)}
                onRemove={() => exercises.remove(e)}
              />
            </li>
          ))}
        </ol>
      )}

      {exercises.fields.length < MAX_DAY_EXERCISES ? (
        <div className="border-border-strong/60 flex flex-col gap-2.5 rounded-tile border-[1.5px] border-dashed p-3.5">
          <ExercisePicker
            label={`Übung zu ${dayName} hinzufügen`}
            hideLabel
            placeholder={`Übung zu ${dayName} hinzufügen, z. B. Kniebeuge`}
            excludeIds={usedIds}
            onSelect={addExercise}
            onCreate={onCreateExercise && ((name) => onCreateExercise(name, addExercise))}
          />
          {topMuscle && <Suggestions muscle={topMuscle} excludeIds={usedIds} onAdd={addExercise} />}
        </div>
      ) : (
        <p className="text-muted text-sm">Höchstens {MAX_DAY_EXERCISES} Übungen pro Tag.</p>
      )}
    </div>
  );
}

function mostFrequentMuscle(muscles: readonly MuscleGroup[]): MuscleGroup | null {
  const counts = new Map<MuscleGroup, number>();
  for (const muscle of muscles) counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
  let best: MuscleGroup | null = null;
  for (const [muscle, count] of counts) if (!best || count > counts.get(best)!) best = muscle;
  return best;
}

/** Passende Übungen aus dem Katalog zum Schwerpunkt des Tags, mit einem Klick hinzuzufügen. */
function Suggestions({
  muscle,
  excludeIds,
  onAdd,
}: {
  muscle: MuscleGroup;
  excludeIds: readonly string[];
  onAdd: (exercise: Exercise) => void;
}) {
  const search = useExerciseSearch({ muscle }, { limit: 12 });
  const items = (search.data?.items ?? [])
    .filter((item) => !item.archived && !excludeIds.includes(item.id))
    .slice(0, 5);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted mr-0.5 text-xs">Schnell hinzufügen:</span>
      {items.map((exercise) => (
        <button
          key={exercise.id}
          type="button"
          aria-label={`${exercise.name} hinzufügen`}
          onClick={() => onAdd(exercise)}
          className="border-border-strong/70 hover:border-accent inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs"
        >
          <Plus aria-hidden="true" className="text-accent size-3" />
          {exercise.name}
        </button>
      ))}
    </div>
  );
}
