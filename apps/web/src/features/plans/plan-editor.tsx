import { MAX_PLAN_DAYS, planContentSchema, type Exercise, type PlanDay } from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
  type FieldError,
  type FieldErrors,
  type Path,
} from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { ExerciseFormDialog } from "@/features/exercises/exercise-form-dialog";
import { cn } from "@/lib/cn";
import { ApiError, errorMessage } from "@/lib/http";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

import { DayEditor } from "./day-editor";
import { DayTabs } from "./day-tabs";
import { toInfoMap, type InfoMap } from "./editor-helpers";
import {
  infoFromExercise,
  toEditorValues,
  type EditorDay,
  type EditorOutput,
  type EditorValues,
  type ExerciseInfo,
} from "./editor-values";
import { WeekSummary } from "./week-summary";

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
  /**
   * Wohin „Neue Übung anlegen“ in der Übungsauswahl speichert: in den Katalog des Coaches oder
   * als private Übung des Athleten.
   */
  exerciseCatalog?: "own" | "private";
}

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
  exerciseCatalog = "own",
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
  const blocker = useUnsavedChanges(isDirty, isSubmitting);

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

  const daysError = (errors.days as FieldError | undefined)?.message ?? errors.days?.root?.message;
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

        <DayTabs
          keys={days.fields.map((field) => field.key)}
          days={watchedDays}
          activeIndex={activeIndex}
          onSelect={setActive}
          onAdd={addDay}
          tabId={tabId}
          panelId={panelId}
        />

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
                  onCreateExercise={(name, onCreated) => setCreateRequest({ name, onCreated })}
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

            <WeekSummary days={watchedDays} infos={infos} />

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
          catalog={exerciseCatalog}
          initialName={createRequest.name}
          onSaved={(exercise) => {
            remember(exercise);
            createRequest.onCreated(exercise);
            setCreateRequest(null);
          }}
          onUseExisting={(exercise) => {
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
