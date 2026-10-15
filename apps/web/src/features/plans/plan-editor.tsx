import {
  detectPlanType,
  MAX_DAY_EXERCISES,
  MAX_PLAN_DAYS,
  MAX_WARMUP_ITEMS,
  planContentSchema,
  weekdayLabels,
  weekdays,
  type Exercise,
  type MuscleGroup,
  type PlanDay,
  type PlanTypeInput,
} from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Copy, Flame, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Controller,
  FormProvider,
  get,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type FieldError,
  type FieldErrors,
  type Path,
} from "react-hook-form";
import { useBlocker } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClasses } from "@/components/ui/input-classes";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { useExerciseSearch } from "@/features/exercises/api";
import { ExerciseFormDialog } from "@/features/exercises/exercise-form-dialog";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import { cn } from "@/lib/cn";
import { ApiError, errorMessage } from "@/lib/http";

import {
  emptySet,
  infoFromExercise,
  toEditorValues,
  type EditorDay,
  type EditorOutput,
  type EditorValues,
  type ExerciseInfo,
} from "./editor-values";
import { ExerciseEntryEditor } from "./exercise-entry-editor";
import { coarseGroups, workingSetsPerGroup } from "./muscle-groups";
import { PlanTypeBadge } from "./plan-type-badge";

type InfoMap = Record<string, ExerciseInfo>;

/** Plan oder Vorlage, wie der Editor sie lädt. */
export interface EditableContent {
  name: string;
  notes: string | null;
  revision: number;
  days: PlanDay[];
  exercises: ExerciseInfo[];
}

interface PlanEditorProps {
  content: EditableContent;
  /** Speichert und liefert den neuen Stand (der Editor übernimmt ihn danach). */
  onSave: (values: EditorOutput & { revision: number }) => Promise<unknown>;
  /** Lädt den aktuellen Stand neu, z. B. nach einem Konflikt. */
  onReload: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Weitere Karten in der rechten Spalte, z. B. frühere Versionen. */
  aside?: ReactNode;
  /** „Neue Übung anlegen“ in der Übungsauswahl anbieten. Nur Coaches haben einen eigenen Katalog. */
  canCreateExercises?: boolean;
}

const toInfoMap = (infos: readonly ExerciseInfo[]): InfoMap =>
  Object.fromEntries(infos.map((info) => [info.id, info]));

function typeInputs(
  exercises: readonly { exerciseId?: string }[] | undefined,
  infos: InfoMap,
): PlanTypeInput[] {
  return (exercises ?? []).flatMap((entry) => {
    const info = entry.exerciseId ? infos[entry.exerciseId] : undefined;
    return info ? [info] : [];
  });
}

const workingSets = (sets: readonly { kind?: string }[] | undefined) =>
  (sets ?? []).filter((set) => set.kind === "working").length;

const shortWeekday = (day: number) => weekdayLabels[day as keyof typeof weekdayLabels].slice(0, 2);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Index des ersten Tags mit Fehlern, sonst -1. */
function firstDayWithErrors(errors: FieldErrors<EditorValues>) {
  const days = errors.days;
  if (!Array.isArray(days)) return -1;
  return days.findIndex(Boolean);
}

/** Kopie eines Tags als neuer Eintrag: ohne IDs, damit der Server neue vergibt. */
function copyDay(day: EditorDay): EditorDay {
  const { id: _day, ...rest } = structuredClone(day);
  return {
    ...rest,
    name: `${day.name} (Kopie)`.slice(0, 40),
    warmup: (rest.warmup ?? []).map(({ id: _warmup, ...item }) => item),
    exercises: (rest.exercises ?? []).map(({ id: _entry, ...entry }) => entry),
  };
}

/**
 * Editor für Pläne und Vorlagen. Trainingstage stehen als Tabs nebeneinander, bearbeitet wird
 * immer ein Tag; gespeichert wird der ganze Plan. Der Schwerpunkt wird live aus den gewählten
 * Übungen erkannt.
 *
 * Übernimmt `content` nur beim ersten Rendern: Die Seite setzt `key` auf die Revision, damit ein
 * neuer Stand vom Server (nach Speichern oder Neuladen) das Formular frisch aufbaut.
 */
export function PlanEditor({
  content,
  onSave,
  onReload,
  onDirtyChange,
  aside,
  canCreateExercises = true,
}: PlanEditorProps) {
  const id = useId();
  const [infos, setInfos] = useState<InfoMap>(() => toInfoMap(content.exercises));
  const [active, setActive] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [createRequest, setCreateRequest] = useState<{
    name: string;
    onCreated: (exercise: Exercise) => void;
  } | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const form = useForm<EditorValues, unknown, EditorOutput>({
    resolver: zodResolver(planContentSchema),
    defaultValues: toEditorValues(content),
  });
  const {
    control,
    register,
    getValues,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = form;
  const days = useFieldArray({ control, name: "days", keyName: "key" });
  const watchedDays = useWatch({ control, name: "days" }) ?? [];
  const activeIndex = Math.min(active, Math.max(days.fields.length - 1, 0));

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  // Ungespeicherte Änderungen: beim Verlassen der Seite nachfragen.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !isSubmitting && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const remember = (exercise: Exercise) =>
    setInfos((current) => ({ ...current, [exercise.id]: infoFromExercise(exercise) }));

  // Fehler an einem anderen Tag: dorthin wechseln, sonst sieht man ihn nicht.
  const showDayWithErrors = (dayIndex: number) => {
    if (dayIndex >= 0) setActive(dayIndex);
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      try {
        await onSave({ ...values, revision: content.revision });
        toast("Gespeichert.");
      } catch (error) {
        if (error instanceof ApiError && error.code === "plan_conflict") {
          setConflict(true);
          return;
        }
        let unmatched = !(error instanceof ApiError) || error.errors.length === 0;
        let errorDay = -1;
        if (error instanceof ApiError) {
          for (const fieldError of error.errors) {
            if (/^(name|notes|days)(\.|$)/.test(fieldError.path)) {
              setError(fieldError.path as Path<EditorValues>, {
                type: "server",
                message: fieldError.message,
              });
              const day = /^days\.(\d+)\./.exec(fieldError.path)?.[1];
              if (day !== undefined && errorDay < 0) errorDay = Number(day);
            } else {
              unmatched = true;
            }
          }
        }
        showDayWithErrors(errorDay);
        setFormError(unmatched ? errorMessage(error) : (error as ApiError).message);
      }
    },
    (invalid) => showDayWithErrors(firstDayWithErrors(invalid)),
  );

  const addDay = () => {
    days.append({
      name: `Tag ${String.fromCharCode(65 + days.fields.length)}`,
      warmup: [],
      exercises: [],
    });
    setActive(days.fields.length);
  };
  const duplicateDay = () => {
    const day = getValues(`days.${activeIndex}`);
    if (!day) return;
    days.insert(activeIndex + 1, copyDay(day));
    setActive(activeIndex + 1);
  };
  const removeDay = () => {
    days.remove(activeIndex);
    setActive(Math.max(0, Math.min(activeIndex, days.fields.length - 2)));
  };
  const moveDay = (to: number) => {
    days.move(activeIndex, to);
    setActive(to);
  };

  const onTabKeyDown = (event: KeyboardEvent, index: number) => {
    const count = days.fields.length;
    const next = {
      ArrowRight: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const planType = detectPlanType(watchedDays.flatMap((day) => typeInputs(day.exercises, infos)));
  const daysError = (errors.days as FieldError | undefined)?.message ?? errors.days?.root?.message;
  const entries = watchedDays.flatMap((day) =>
    (day.exercises ?? []).map((entry) => ({
      info: entry.exerciseId ? infos[entry.exerciseId] : undefined,
      workingSets: workingSets(entry.sets),
    })),
  );
  const volume = workingSetsPerGroup(entries);
  const maxVolume = Math.max(12, ...Object.values(volume));
  const totalSets = entries.reduce((sum, entry) => sum + entry.workingSets, 0);
  const tabId = (index: number) => `${id}-tab-${index}`;
  const panelId = (index: number) => `${id}-panel-${index}`;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {conflict && (
          <Alert variant="warning" title="Inzwischen geändert">
            <p>
              Der Stand wurde in einem anderen Fenster oder von jemand anderem gespeichert. Lade ihn
              neu; deine Änderungen hier gehen dabei verloren.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={onReload}>
              Neu laden
            </Button>
          </Alert>
        )}
        {formError && <Alert variant="error">{formError}</Alert>}
        {daysError && <Alert variant="error">{daysError}</Alert>}

        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {days.fields.length > 0 && (
            <div role="tablist" aria-label="Trainingstage" className="flex gap-2.5">
              {days.fields.map((field, d) => {
                const day = watchedDays[d];
                const selected = d === activeIndex;
                const exerciseCount = day?.exercises?.length ?? 0;
                const setCount = (day?.exercises ?? []).reduce(
                  (sum, entry) => sum + workingSets(entry.sets),
                  0,
                );
                const hasErrors = Boolean(get(errors, `days.${d}`));
                return (
                  <button
                    key={field.key}
                    ref={(element) => {
                      tabRefs.current[d] = element;
                    }}
                    id={tabId(d)}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId(d)}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(d)}
                    onKeyDown={(event) => onTabKeyDown(event, d)}
                    className={cn(
                      "flex w-48 shrink-0 flex-col gap-1.5 rounded-tile border px-3.5 py-3 text-left transition-colors",
                      selected
                        ? "bg-surface border-accent/60 shadow-[inset_0_-3px_0_var(--accent)]"
                        : "bg-surface/50 border-border hover:bg-surface",
                      hasErrors && "border-danger",
                    )}
                  >
                    <span className="text-muted flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        Tag {d + 1}
                        {hasErrors && (
                          <>
                            <span aria-hidden="true" className="bg-danger size-2 rounded-full" />
                            <span className="sr-only">, enthält Fehler</span>
                          </>
                        )}
                      </span>
                      <span className="bg-inset text-text rounded-md px-1.5 py-px font-medium">
                        {day?.weekday ? shortWeekday(day.weekday) : "Flexibel"}
                      </span>
                    </span>
                    <span className="truncate font-medium">
                      {day?.name?.trim() || "Ohne Namen"}
                    </span>
                    <span className="text-muted text-xs">
                      {plural(exerciseCount, "Übung", "Übungen")} ·{" "}
                      {plural(setCount, "Satz", "Sätze")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {days.fields.length < MAX_PLAN_DAYS && (
            <button
              type="button"
              onClick={addDay}
              className="border-border-strong/60 text-accent hover:border-accent flex w-36 shrink-0 flex-col items-center justify-center gap-1 rounded-tile border-[1.5px] border-dashed py-3 text-sm font-medium"
            >
              <Plus aria-hidden="true" className="size-4" /> Tag hinzufügen
            </button>
          )}
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            {/* Alle Tage bleiben eingehängt (nur verborgen): Beim Neu-Einhängen würde react-hook-form
                geleerte Felder auf den geladenen Stand zurücksetzen. */}
            {days.fields.map((field, d) => (
              <div
                key={field.key}
                id={panelId(d)}
                role="tabpanel"
                aria-labelledby={tabId(d)}
                hidden={d !== activeIndex}
              >
                <DayEditor
                  index={d}
                  count={days.fields.length}
                  infos={infos}
                  canDuplicate={days.fields.length < MAX_PLAN_DAYS}
                  onMove={moveDay}
                  onDuplicate={duplicateDay}
                  onRemove={removeDay}
                  onPick={remember}
                  onCreateExercise={
                    canCreateExercises
                      ? (name, onCreated) => setCreateRequest({ name, onCreated })
                      : undefined
                  }
                />
              </div>
            ))}
            {days.fields.length === 0 && (
              <div className="text-muted border-border-strong/60 rounded-tile border-[1.5px] border-dashed p-7 text-center">
                Noch keine Trainingstage. Lege den ersten Tag an.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <section
              aria-labelledby={`${id}-plan`}
              className="bg-surface flex flex-col gap-3 rounded-tile p-4"
            >
              <h2 id={`${id}-plan`} className="font-medium">
                Plan
              </h2>
              <TextField
                label="Name"
                required
                autoComplete="off"
                error={errors.name?.message}
                {...register("name")}
              />
              <TextareaField
                label="Hinweise für den Athleten"
                hint="Steht über dem Plan, z. B. Ziel des Blocks."
                rows={4}
                error={errors.notes?.message}
                {...register("notes")}
              />
            </section>

            <section
              aria-labelledby={`${id}-week`}
              className="bg-surface flex flex-col gap-3.5 rounded-tile p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`${id}-week`} className="font-medium">
                  Woche im Überblick
                </h2>
                <PlanTypeBadge type={planType} />
              </div>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  ["Tage", days.fields.length],
                  ["Übungen", entries.length],
                  ["Arbeitssätze", totalSets],
                ].map(([label, value]) => (
                  <div key={label} className="bg-inset flex flex-col rounded-card p-2.5">
                    <dt className="text-muted order-last text-xs">{label}</dt>
                    <dd className="text-xl font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col gap-2">
                <h3 className="text-muted text-xs font-normal">Arbeitssätze pro Muskelgruppe</h3>
                <ul className="flex flex-col gap-2">
                  {coarseGroups.map((group) => (
                    <li
                      key={group}
                      className="grid grid-cols-[4.75rem_minmax(0,1fr)_1.75rem] items-center gap-2.5 text-xs"
                    >
                      <span>{group}</span>
                      <span
                        aria-hidden="true"
                        className="bg-inset h-2 overflow-hidden rounded-full"
                      >
                        <span
                          className="bg-accent block h-full rounded-full transition-[width]"
                          style={{ width: `${Math.round((volume[group] / maxVolume) * 100)}%` }}
                        />
                      </span>
                      <span className="text-right font-medium tabular-nums">{volume[group]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {aside}
          </div>
        </div>

        <div className="bg-bg/90 border-border sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
          <p className="text-muted mr-auto flex items-center gap-2 text-sm" role="status">
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", isDirty ? "bg-warning" : "bg-success")}
            />
            {isDirty ? "Ungespeicherte Änderungen" : "Alles gespeichert"}
          </p>
          <Button
            variant="ghost"
            className="text-muted"
            disabled={!isDirty || isSubmitting}
            onClick={() => {
              reset(toEditorValues(content));
              setInfos(toInfoMap(content.exercises));
              setActive(0);
              setFormError(null);
            }}
          >
            Verwerfen
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Speichern
          </Button>
        </div>
      </form>

      {createRequest && (
        <ExerciseFormDialog
          open
          onOpenChange={(open) => !open && setCreateRequest(null)}
          catalog="own"
          initialName={createRequest.name}
          onSaved={(exercise) => {
            remember(exercise);
            createRequest.onCreated(exercise);
            setCreateRequest(null);
          }}
        />
      )}

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Ungespeicherte Änderungen verwerfen?"
        description="Wenn du die Seite verlässt, gehen deine Änderungen verloren."
        confirmLabel="Verwerfen und verlassen"
        cancelLabel="Weiter bearbeiten"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </FormProvider>
  );
}

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

function DayEditor({
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

/** Warm-up als Chips. Neue Einträge: Katalog-Übung wählen oder Freitext, dazu Details. */
function WarmupEditor({
  base,
  infos,
  dayName,
  onPick,
}: {
  base: `days.${number}`;
  infos: InfoMap;
  dayName: string;
  onPick: (exercise: Exercise) => void;
}) {
  const id = useId();
  const {
    control,
    formState: { errors },
  } = useFormContext<EditorValues>();
  const warmup = useFieldArray({ control, name: `${base}.warmup`, keyName: "key" });
  const items = useWatch({ control, name: `${base}.warmup` }) ?? [];
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [picked, setPicked] = useState<Exercise | null>(null);
  const error = (path: string) =>
    (get(errors, `${base}.warmup.${path}`) as FieldError | undefined)?.message;
  const canAdd = picked !== null || name.trim().length >= 2;

  const add = () => {
    if (picked) {
      onPick(picked);
      warmup.append({ exerciseId: picked.id, name: picked.name, details: details.trim() });
    } else if (name.trim().length >= 2) {
      warmup.append({ exerciseId: null, name: name.trim(), details: details.trim() });
    } else {
      return;
    }
    setName("");
    setDetails("");
    setPicked(null);
  };

  const itemErrors = warmup.fields.flatMap((_, w) =>
    ["exerciseId", "name", "details"].flatMap((path) => {
      const message = error(`${w}.${path}`);
      return message ? [message] : [];
    }),
  );

  return (
    <div className="flex flex-wrap items-start gap-3">
      <span
        id={`${id}-label`}
        className="text-muted inline-flex w-20 items-center gap-1.5 pt-2 text-sm"
      >
        <Flame aria-hidden="true" className="text-module-checkin size-3.5" /> Warm-up
      </span>
      <div className="flex min-w-64 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {warmup.fields.length > 0 && (
            <ul aria-labelledby={`${id}-label`} className="contents">
              {warmup.fields.map((field, w) => {
                const item = items[w];
                const fromCatalog = Boolean(item?.exerciseId);
                const info = fromCatalog ? infos[item!.exerciseId!] : undefined;
                const label = (fromCatalog ? info?.name : item?.name) || `Eintrag ${w + 1}`;
                const invalid = ["exerciseId", "name", "details"].some((path) =>
                  error(`${w}.${path}`),
                );
                return (
                  <li
                    key={field.key}
                    className={cn(
                      "bg-inset inline-flex h-9 items-center gap-2 rounded-card border pr-1 pl-3 text-sm",
                      invalid ? "border-danger" : "border-border",
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    {info?.archived && <Badge tone="warning">Archiviert</Badge>}
                    {item?.details && <span className="text-muted">{item.details}</span>}
                    <button
                      type="button"
                      aria-label={`${label} aus dem Warm-up entfernen`}
                      onClick={() => warmup.remove(w)}
                      className="text-muted hover:text-text flex size-7 items-center justify-center rounded-lg"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {warmup.fields.length < MAX_WARMUP_ITEMS && (
            <div className="flex flex-wrap items-center gap-1.5">
              <ExercisePicker
                label={`Warm-up-Übung für ${dayName}`}
                hideLabel
                placeholder="Übung"
                className="w-44"
                inputClassName="h-9 text-sm"
                value={name}
                onValueChange={(value) => {
                  setName(value);
                  setPicked(null);
                }}
                excludeIds={items.flatMap((item) => (item.exerciseId ? [item.exerciseId] : []))}
                onSelect={(exercise) => {
                  setPicked(exercise);
                  setName(exercise.name);
                }}
                onCreate={(text) => setName(text)}
                createLabel={(text) => `„${text}“ als Freitext verwenden`}
              />
              <input
                type="text"
                autoComplete="off"
                aria-label={`Details zum Warm-up für ${dayName}`}
                placeholder="z. B. 5 min locker"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    add();
                  }
                }}
                className={cn(inputClasses, "h-9 w-36 text-sm")}
              />
              <Button
                variant="secondary"
                size="icon"
                className="text-accent size-9"
                aria-label="Warm-up hinzufügen"
                disabled={!canAdd}
                onClick={add}
              >
                <Plus aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}
        </div>
        {itemErrors.length > 0 && (
          <ul className="text-danger flex flex-col gap-0.5 text-sm">
            {itemErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
