import {
  detectPlanType,
  MAX_DAY_EXERCISES,
  MAX_PLAN_DAYS,
  MAX_WARMUP_ITEMS,
  planContentSchema,
  weekdayLabels,
  weekdays,
  type Exercise,
  type PlanDay,
  type PlanTypeInput,
} from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, CalendarPlus, Flame, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  FormProvider,
  get,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type FieldError,
  type Path,
} from "react-hook-form";
import { useBlocker } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { ExerciseFormDialog } from "@/features/exercises/exercise-form-dialog";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import { numberInput } from "@/lib/form-values";
import { ApiError, errorMessage } from "@/lib/http";

import {
  emptySet,
  infoFromExercise,
  toEditorValues,
  type EditorOutput,
  type EditorValues,
  type ExerciseInfo,
} from "./editor-values";
import { ExerciseEntryEditor } from "./exercise-entry-editor";
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
  /** Hinweis über dem Formular, z. B. „Änderungen sieht der Athlet sofort“. */
  notice?: ReactNode;
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

/**
 * Editor für Pläne und Vorlagen. Tage, Übungen und Sätze werden lokal bearbeitet und gemeinsam
 * gespeichert. Der Schwerpunkt wird live aus den gewählten Übungen erkannt.
 *
 * Übernimmt `content` nur beim ersten Rendern: Die Seite setzt `key` auf die Revision, damit ein
 * neuer Stand vom Server (nach Speichern oder Neuladen) das Formular frisch aufbaut.
 */
export function PlanEditor({ content, onSave, onReload, onDirtyChange, notice }: PlanEditorProps) {
  const [infos, setInfos] = useState<InfoMap>(() => toInfoMap(content.exercises));
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
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = form;
  const days = useFieldArray({ control, name: "days", keyName: "key" });
  const watchedDays = useWatch({ control, name: "days" });

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

  const onSubmit = handleSubmit(async (values) => {
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
      if (error instanceof ApiError) {
        for (const fieldError of error.errors) {
          if (/^(name|notes|days)(\.|$)/.test(fieldError.path)) {
            setError(fieldError.path as Path<EditorValues>, {
              type: "server",
              message: fieldError.message,
            });
          } else {
            unmatched = true;
          }
        }
      }
      setFormError(unmatched ? errorMessage(error) : (error as ApiError).message);
    }
  });

  const planType = detectPlanType(
    (watchedDays ?? []).flatMap((day) => typeInputs(day.exercises, infos)),
  );
  const daysError = (errors.days as FieldError | undefined)?.message ?? errors.days?.root?.message;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pb-24">
        {notice}
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

        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted text-sm">Erkannter Schwerpunkt:</span>
              <PlanTypeBadge type={planType} />
            </div>
            <TextField
              label="Name"
              required
              autoComplete="off"
              error={errors.name?.message}
              {...register("name")}
            />
            <TextareaField
              label="Hinweise für den Athleten"
              hint="Erscheint über dem Plan, z. B. Ziel des Blocks oder wie die Gewichte gemeint sind."
              error={errors.notes?.message}
              {...register("notes")}
            />
          </CardBody>
        </Card>

        {daysError && <Alert variant="error">{daysError}</Alert>}

        {days.fields.map((field, d) => (
          <DayEditor
            key={field.key}
            index={d}
            count={days.fields.length}
            infos={infos}
            onMove={(to) => days.move(d, to)}
            onRemove={() => days.remove(d)}
            onPick={remember}
            onCreateExercise={(name, onCreated) => setCreateRequest({ name, onCreated })}
          />
        ))}

        {days.fields.length === 0 && (
          <Card>
            <CardBody className="text-muted text-center">
              Noch keine Trainingstage. Lege den ersten Tag an.
            </CardBody>
          </Card>
        )}

        <div>
          <Button
            variant="secondary"
            disabled={days.fields.length >= MAX_PLAN_DAYS}
            onClick={() =>
              days.append({
                name: `Tag ${String.fromCharCode(65 + days.fields.length)}`,
                warmup: [],
                exercises: [],
              })
            }
          >
            <CalendarPlus aria-hidden="true" className="size-4" /> Trainingstag hinzufügen
          </Button>
          {days.fields.length >= MAX_PLAN_DAYS && (
            <p className="text-muted mt-1 text-sm">Höchstens {MAX_PLAN_DAYS} Trainingstage.</p>
          )}
        </div>

        <div className="bg-surface border-border sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:mx-0 sm:rounded-card sm:border">
          <p className="text-muted mr-auto text-sm" role="status">
            {isDirty ? "Ungespeicherte Änderungen" : "Alles gespeichert"}
          </p>
          <Button
            variant="ghost"
            disabled={!isDirty || isSubmitting}
            onClick={() => {
              reset(toEditorValues(content));
              setInfos(toInfoMap(content.exercises));
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
  onMove: (to: number) => void;
  onRemove: () => void;
  onPick: (exercise: Exercise) => void;
  onCreateExercise: (name: string, onCreated: (exercise: Exercise) => void) => void;
}

function DayEditor({
  index,
  count,
  infos,
  onMove,
  onRemove,
  onPick,
  onCreateExercise,
}: DayEditorProps) {
  const base = `days.${index}` as const;
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<EditorValues>();
  const exercises = useFieldArray({ control, name: `${base}.exercises`, keyName: "key" });
  const warmup = useFieldArray({ control, name: `${base}.warmup`, keyName: "key" });
  const watched = useWatch({ control, name: base });
  const dayName = watched?.name?.trim() || `Tag ${index + 1}`;
  const error = (path: string) =>
    (get(errors, `${base}.${path}`) as FieldError | undefined)?.message;
  const exercisesError = error("exercises") ?? error("exercises.root");
  const headingId = `day-${index}-heading`;

  const addExercise = (exercise: Exercise) => {
    onPick(exercise);
    exercises.append({ exerciseId: exercise.id, sets: [emptySet(), emptySet(), emptySet()] });
  };
  const addWarmup = (exercise: Exercise) => {
    onPick(exercise);
    warmup.append({ exerciseId: exercise.id, name: exercise.name, details: "" });
  };

  return (
    <Card aria-labelledby={headingId}>
      <div className="border-bg flex flex-wrap items-center gap-2 border-b-[2.5px] px-4 py-2.5">
        <h2
          id={headingId}
          className="flex flex-1 flex-wrap items-center gap-2 text-base font-medium"
        >
          <span>
            Tag {index + 1}: {dayName}
          </span>
          <PlanTypeBadge type={detectPlanType(typeInputs(watched?.exercises, infos))} />
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${dayName} nach oben`}
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${dayName} nach unten`}
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-danger"
          aria-label={`${dayName} entfernen`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <CardBody className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name des Tages"
            required
            autoComplete="off"
            placeholder="z. B. Oberkörper A"
            error={error("name")}
            {...register(`${base}.name`)}
          />
          <SelectField
            label="Wochentag"
            placeholder="Flexibel"
            options={weekdays.map((day) => ({ value: String(day), label: weekdayLabels[day] }))}
            error={error("weekday")}
            {...register(`${base}.weekday`, numberInput)}
          />
        </div>

        <section className="flex flex-col gap-3" aria-labelledby={`${headingId}-warmup`}>
          <h3 id={`${headingId}-warmup`} className="flex items-center gap-2 font-medium">
            <Flame aria-hidden="true" className="text-module-hints size-4" /> Warm-up
          </h3>
          {warmup.fields.length > 0 && (
            <ul className="flex flex-col gap-3">
              {warmup.fields.map((field, w) => {
                const item = watched?.warmup?.[w];
                const fromCatalog = Boolean(item?.exerciseId);
                const label =
                  (fromCatalog ? infos[item!.exerciseId!]?.name : item?.name) || `Eintrag ${w + 1}`;
                return (
                  <li
                    key={field.key}
                    className="grid items-start gap-2 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    {fromCatalog ? (
                      <div className="flex min-h-11 flex-col justify-center sm:mt-7">
                        <span className="flex flex-wrap items-center gap-2 font-medium">
                          {label}
                          {infos[item!.exerciseId!]?.archived && (
                            <Badge tone="warning">Archiviert</Badge>
                          )}
                        </span>
                        {error(`warmup.${w}.exerciseId`) && (
                          <span className="text-danger text-sm">
                            {error(`warmup.${w}.exerciseId`)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <TextField
                        label={`Warm-up ${w + 1}`}
                        autoComplete="off"
                        error={error(`warmup.${w}.name`)}
                        {...register(`${base}.warmup.${w}.name`)}
                      />
                    )}
                    <TextField
                      label={`Details zu ${label}`}
                      autoComplete="off"
                      placeholder="z. B. 5 min locker"
                      error={error(`warmup.${w}.details`)}
                      {...register(`${base}.warmup.${w}.details`)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-danger sm:mt-7"
                      aria-label={`${label} aus dem Warm-up entfernen`}
                      onClick={() => warmup.remove(w)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {warmup.fields.length < MAX_WARMUP_ITEMS ? (
            <div className="flex flex-wrap items-end gap-2">
              <ExercisePicker
                label={`Warm-up-Übung für ${dayName} hinzufügen`}
                placeholder="z. B. Rudergerät, Hüftmobilisation"
                className="min-w-60 flex-1"
                excludeIds={(watched?.warmup ?? []).flatMap((x) =>
                  x.exerciseId ? [x.exerciseId] : [],
                )}
                onSelect={addWarmup}
                onCreate={(name) => onCreateExercise(name, addWarmup)}
              />
              <Button
                variant="secondary"
                onClick={() => warmup.append({ exerciseId: null, name: "", details: "" })}
              >
                <Plus aria-hidden="true" className="size-4" /> Freitext
              </Button>
            </div>
          ) : (
            <p className="text-muted text-sm">Höchstens {MAX_WARMUP_ITEMS} Warm-up-Einträge.</p>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby={`${headingId}-exercises`}>
          <h3 id={`${headingId}-exercises`} className="font-medium">
            Übungen
          </h3>
          {exercisesError && <p className="text-danger text-sm">{exercisesError}</p>}
          {exercises.fields.length === 0 && (
            <p className="text-muted text-sm">Noch keine Übungen an diesem Tag.</p>
          )}
          <ol className="flex flex-col gap-3">
            {exercises.fields.map((field, e) => (
              <li key={field.key}>
                <ExerciseEntryEditor
                  dayIndex={index}
                  index={e}
                  count={exercises.fields.length}
                  info={infos[field.exerciseId]}
                  onMove={(to) => exercises.move(e, to)}
                  onRemove={() => exercises.remove(e)}
                />
              </li>
            ))}
          </ol>
          {exercises.fields.length < MAX_DAY_EXERCISES ? (
            <ExercisePicker
              label={`Übung zu ${dayName} hinzufügen`}
              excludeIds={(watched?.exercises ?? []).map((x) => x.exerciseId)}
              onSelect={addExercise}
              onCreate={(name) => onCreateExercise(name, addExercise)}
            />
          ) : (
            <p className="text-muted text-sm">Höchstens {MAX_DAY_EXERCISES} Übungen pro Tag.</p>
          )}
        </section>
      </CardBody>
    </Card>
  );
}
