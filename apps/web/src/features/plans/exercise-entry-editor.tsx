import { MAX_EXERCISE_SETS, type PlanSet } from "@athletept/shared";
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, Timer, Trash2, X, Zap } from "lucide-react";
import { useId, useState } from "react";
import { get, useFieldArray, useFormContext, useWatch, type FieldError } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextareaField } from "@/components/ui/textarea-field";
import { cn } from "@/lib/cn";
import { numberInput } from "@/lib/form-values";

import { emptySet, type EditorSet, type EditorValues, type ExerciseInfo } from "./editor-values";
import { formatSetGroup, groupSets, parseSetShorthand } from "./format";
import { exerciseTag } from "./muscle-groups";

type Mode = "reps" | "duration";

/** Zahl in der Kachel: wirkt wie Text, zeigt beim Überfahren und Fokus einen Rahmen. */
const tileInput = cn(
  "h-9 rounded-lg border border-transparent bg-transparent p-0 text-center text-xl font-medium",
  "hover:border-border-strong focus-visible:border-accent focus-visible:outline-none",
  "aria-[invalid=true]:border-danger",
);
const pillInput = cn(tileInput, "h-7 text-sm font-medium");

const MAX_REST_SECONDS = 900;
const REST_STEP = 15;

const toPlanSet = (set: EditorSet): PlanSet => ({
  kind: set.kind,
  repsMin: set.repsMin ?? null,
  repsMax: set.repsMax ?? null,
  durationSeconds: set.durationSeconds ?? null,
  weightKg: set.weightKg ?? null,
  rir: set.rir ?? null,
});

/** „3 × 6–8 Wdh. · 80 kg · RIR 2 · +1 Aufwärmen“ */
function summarizeSets(sets: readonly EditorSet[]) {
  const working = sets.filter((set) => set.kind === "working").map(toPlanSet);
  const warmups = sets.length - working.length;
  const groups = groupSets(working);
  let text: string;
  if (working.length === 0) {
    text = warmups > 0 ? "Noch keine Arbeitssätze" : "Noch keine Sätze";
  } else if (groups.length === 1 && groups[0]!.text) {
    text = formatSetGroup(groups[0]!);
  } else {
    text = `${working.length} Arbeitssätze, unterschiedlich`;
  }
  return warmups > 0 ? `${text} · +${warmups} Aufwärmen` : text;
}

/** Namen der Sätze wie in den Kacheln: Aufwärmsätze mit „W“, Arbeitssätze durchgezählt. */
function setNames(sets: readonly Pick<EditorSet, "kind">[]) {
  const warmupCount = sets.filter((set) => set.kind === "warmup").length;
  let working = 0;
  let warmup = 0;
  return sets.map((set) => {
    if (set.kind === "warmup") {
      warmup += 1;
      return { badge: "W", name: warmupCount > 1 ? `Aufwärmsatz ${warmup}` : "Aufwärmsatz" };
    }
    working += 1;
    return { badge: String(working), name: `Satz ${working}` };
  });
}

interface ExerciseEntryEditorProps {
  dayIndex: number;
  index: number;
  count: number;
  /** Fehlt nur, wenn die Übung noch nicht geladen ist. */
  info: ExerciseInfo | undefined;
  open: boolean;
  onToggle: () => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/** Eine Übung im Trainingstag: zugeklappt eine Zusammenfassung, aufgeklappt Sätze als Kacheln. */
export function ExerciseEntryEditor({
  dayIndex,
  index,
  count,
  info,
  open,
  onToggle,
  onMove,
  onRemove,
}: ExerciseEntryEditorProps) {
  const id = useId();
  const base = `days.${dayIndex}.exercises.${index}` as const;
  const {
    control,
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<EditorValues>();
  const sets = useFieldArray({ control, name: `${base}.sets`, keyName: "key" });
  const watchedSets = useWatch({ control, name: `${base}.sets` }) ?? [];
  const rest = useWatch({ control, name: `${base}.restSeconds` });
  const notes = useWatch({ control, name: `${base}.notes` });
  const [mode, setMode] = useState<Mode>(() =>
    (getValues(`${base}.sets`) ?? []).some((set) => typeof set.durationSeconds === "number")
      ? "duration"
      : "reps",
  );
  const [shorthand, setShorthand] = useState("");
  const [shorthandError, setShorthandError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  const name = info?.name ?? "Übung";
  const tag = exerciseTag(info);
  const error = (path: string) =>
    (get(errors, `${base}.${path}`) as FieldError | undefined)?.message;
  const names = setNames(watchedSets);
  const panelId = `${id}-panel`;
  const errorsId = `${id}-set-errors`;

  const switchMode = (next: Mode) => {
    setMode(next);
    (getValues(`${base}.sets`) ?? []).forEach((_, s) => {
      const fields =
        next === "reps" ? (["durationSeconds"] as const) : (["repsMin", "repsMax"] as const);
      for (const field of fields) {
        setValue(`${base}.sets.${s}.${field}`, undefined, { shouldDirty: true });
      }
    });
  };

  const applyShorthand = () => {
    const parsed = parseSetShorthand(shorthand);
    if (!parsed) {
      setShorthandError("Nicht erkannt. Beispiele: 4x8, 3 × 8–10 @ 80 kg RIR 2, 3x45s");
      return;
    }
    const warmups = (getValues(`${base}.sets`) ?? []).filter((set) => set.kind === "warmup");
    const working: EditorSet[] = parsed.map((set) => ({
      kind: set.kind,
      repsMin: set.repsMin ?? undefined,
      repsMax: set.repsMax ?? undefined,
      durationSeconds: set.durationSeconds ?? undefined,
      weightKg: set.weightKg ?? undefined,
      rir: set.rir ?? undefined,
    }));
    sets.replace([...warmups, ...working]);
    setMode(parsed[0]!.durationSeconds !== null ? "duration" : "reps");
    setShorthand("");
    setShorthandError(null);
  };

  const changeRest = (step: number) => {
    const current = getValues(`${base}.restSeconds`);
    const valid = typeof current === "number" && Number.isFinite(current) ? current : null;
    let next: number | undefined;
    if (step > 0) next = Math.min((valid ?? 0) + step, MAX_REST_SECONDS);
    else next = valid === null || valid === 0 ? undefined : Math.max(valid + step, 0);
    setValue(`${base}.restSeconds`, next, {
      shouldDirty: true,
      shouldValidate: Boolean(error("restSeconds")),
    });
  };

  const addSet = () => {
    const last = (getValues(`${base}.sets`) ?? []).at(-1);
    sets.append(last ? { ...last, kind: "working" } : emptySet());
  };

  const toggleKind = (s: number) => {
    const kind = getValues(`${base}.sets.${s}.kind`);
    if (kind === "working") {
      setValue(`${base}.sets.${s}.kind`, "warmup", { shouldDirty: true });
      setValue(`${base}.sets.${s}.repsMax`, undefined, { shouldDirty: true });
      setValue(`${base}.sets.${s}.rir`, undefined, { shouldDirty: true });
    } else {
      setValue(`${base}.sets.${s}.kind`, "working", { shouldDirty: true });
    }
  };

  const setErrors = sets.fields.flatMap((_, s) =>
    (["repsMin", "repsMax", "durationSeconds", "weightKg", "rir"] as const).flatMap((field) => {
      const message = error(`sets.${s}.${field}`);
      return message ? [`${names[s]?.name ?? `Satz ${s + 1}`}: ${message}`] : [];
    }),
  );
  const setsError =
    error("sets") ?? (get(errors, `${base}.sets.root`) as FieldError | undefined)?.message;
  const showNote = noteOpen || Boolean(notes) || Boolean(error("notes"));

  return (
    <article
      className={cn(
        "bg-surface rounded-tile border",
        open ? "border-border" : "border-transparent",
        error("exerciseId") && "border-danger",
      )}
    >
      <div className="flex items-center gap-1 py-1.5 pr-2 pl-1.5">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="hover:bg-inset/60 flex w-full min-w-0 items-center gap-3 rounded-card p-2 text-left"
          >
            <span className="bg-inset flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium tabular-nums">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{name}</span>
                {tag && (
                  <span className="bg-inset text-muted shrink-0 rounded-md px-2 py-px text-xs font-normal">
                    {tag}
                  </span>
                )}
                {info?.archived && <Badge tone="warning">Archiviert</Badge>}
                {info && !info.archived && !info.selectable && (
                  <Badge tone="neutral">Nicht in deinem Katalog</Badge>
                )}
              </span>
              <span className="text-muted truncate text-sm font-normal">
                {summarizeSets(watchedSets)}
              </span>
            </span>
            {typeof rest === "number" && Number.isFinite(rest) && (
              <span className="text-muted hidden shrink-0 items-center gap-1 text-xs font-normal sm:inline-flex">
                <Timer aria-hidden="true" className="size-3.5" />
                <span className="sr-only">Pause</span> {rest} s
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "text-muted size-5 shrink-0 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </h3>
        <div className="flex shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`${name} nach oben`}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`${name} nach unten`}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-danger size-9"
            aria-label={`${name} entfernen`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
      {error("exerciseId") && (
        <p className="text-danger px-4 pb-2 text-sm">{error("exerciseId")}</p>
      )}

      <div id={panelId} hidden={!open} className="flex flex-col gap-4 px-4 pt-1 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedControl
            label={`Vorgabe für ${name}`}
            className="bg-inset rounded-card p-1 [&>button]:min-h-8 [&>button]:py-1 [&>button[aria-checked=true]]:bg-surface"
            options={[
              { value: "reps", label: "Wiederholungen" },
              { value: "duration", label: "Dauer" },
            ]}
            value={mode}
            onChange={switchMode}
          />
          <div className="bg-inset inline-flex items-center gap-0.5 rounded-card p-1">
            <label htmlFor={`${id}-rest`} className="text-muted px-2 text-xs">
              Pause
            </label>
            <button
              type="button"
              aria-label={`Pause ${REST_STEP} Sekunden kürzer`}
              onClick={() => changeRest(-REST_STEP)}
              className="bg-surface hover:text-accent size-8 rounded-lg text-base"
            >
              −
            </button>
            <input
              id={`${id}-rest`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="–"
              aria-invalid={error("restSeconds") ? true : undefined}
              aria-describedby={error("restSeconds") ? `${id}-rest-error` : undefined}
              className={cn(pillInput, "w-12 tabular-nums")}
              {...register(`${base}.restSeconds`, numberInput)}
            />
            <span aria-hidden="true" className="text-muted pr-1 text-xs">
              s
            </span>
            <button
              type="button"
              aria-label={`Pause ${REST_STEP} Sekunden länger`}
              onClick={() => changeRest(REST_STEP)}
              className="bg-surface hover:text-accent size-8 rounded-lg text-base"
            >
              +
            </button>
          </div>
          <div className="flex min-w-60 flex-1 gap-1.5">
            <div className="relative flex-1">
              <Zap
                aria-hidden="true"
                className="text-accent pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <input
                type="text"
                autoComplete="off"
                aria-label="Schnelleingabe Arbeitssätze"
                aria-invalid={shorthandError ? true : undefined}
                aria-describedby={shorthandError ? `${id}-shorthand-error` : undefined}
                placeholder={
                  mode === "duration" ? "Schnell: 3 × 30 s" : "Schnell: 3 × 8–10 @ 80 kg RIR 2"
                }
                className={cn(inputClasses, "h-10 pl-9 text-sm")}
                value={shorthand}
                onChange={(event) => {
                  setShorthand(event.target.value);
                  setShorthandError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyShorthand();
                  }
                }}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="h-10"
              disabled={!shorthand.trim()}
              onClick={applyShorthand}
            >
              Übernehmen
            </Button>
          </div>
        </div>
        {shorthandError && (
          <p id={`${id}-shorthand-error`} className="text-danger -mt-2 text-sm">
            {shorthandError}
          </p>
        )}
        {error("restSeconds") && (
          <p id={`${id}-rest-error`} className="text-danger -mt-2 text-sm">
            Pause: {error("restSeconds")}
          </p>
        )}

        <ul
          aria-label={`Sätze für ${name}`}
          className="grid grid-cols-[repeat(auto-fill,minmax(9.75rem,1fr))] gap-2"
        >
          {sets.fields.map((field, s) => {
            const set = watchedSets[s];
            const warmup = set?.kind === "warmup";
            const label = names[s]?.name ?? `Satz ${s + 1}`;
            const invalid = (path: string) =>
              error(`sets.${s}.${path}`)
                ? { "aria-invalid": true as const, "aria-describedby": errorsId }
                : {};
            const hasError = (
              ["repsMin", "repsMax", "durationSeconds", "weightKg", "rir"] as const
            ).some((path) => error(`sets.${s}.${path}`));
            const showTo =
              !warmup || (typeof set?.repsMax === "number" && set.repsMax !== set.repsMin);
            const showRir = !warmup || typeof set?.rir === "number";
            return (
              <li
                key={field.key}
                className={cn(
                  "bg-inset flex flex-col gap-1.5 rounded-tile border py-2 pr-1.5 pl-2.5",
                  hasError ? "border-danger" : warmup ? "border-warning/30" : "border-border",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                      warmup ? "bg-warning/15 text-warning" : "bg-surface",
                    )}
                  >
                    {names[s]?.badge}
                  </span>
                  <button
                    type="button"
                    aria-label={`${label}: Art wechseln, jetzt ${warmup ? "Aufwärmsatz" : "Arbeitssatz"}`}
                    onClick={() => toggleKind(s)}
                    className={cn(
                      "h-6 rounded-md px-2 text-xs font-medium",
                      warmup
                        ? "bg-warning/15 text-warning"
                        : "bg-surface text-muted hover:text-text",
                    )}
                  >
                    {warmup ? "Aufwärmen" : "Arbeitssatz"}
                  </button>
                  <span className="flex-1" />
                  <button
                    type="button"
                    aria-label={`${label} entfernen`}
                    disabled={sets.fields.length === 1}
                    onClick={() => sets.remove(s)}
                    className="text-muted hover:text-text flex size-7 items-center justify-center rounded-lg disabled:opacity-40"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
                {mode === "reps" ? (
                  <div className="flex items-baseline gap-0.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="–"
                      aria-label={`${label}: Wiederholungen von`}
                      className={cn(tileInput, "w-10")}
                      {...invalid("repsMin")}
                      {...register(`${base}.sets.${s}.repsMin`, numberInput)}
                    />
                    {showTo && (
                      <>
                        <span aria-hidden="true" className="text-muted">
                          –
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="–"
                          aria-label={`${label}: Wiederholungen bis`}
                          className={cn(tileInput, "w-10")}
                          {...invalid("repsMax")}
                          {...register(`${base}.sets.${s}.repsMax`, numberInput)}
                        />
                      </>
                    )}
                    <span aria-hidden="true" className="text-muted ml-0.5 text-xs">
                      Wdh.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-0.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="–"
                      aria-label={`${label}: Dauer in Sekunden`}
                      className={cn(tileInput, "w-14")}
                      {...invalid("durationSeconds")}
                      {...register(`${base}.sets.${s}.durationSeconds`, numberInput)}
                    />
                    <span aria-hidden="true" className="text-muted ml-0.5 text-xs">
                      Sek.
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-bg/60 text-muted inline-flex h-8 items-center gap-0.5 rounded-lg pr-2 pl-0.5 text-xs">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="–"
                      aria-label={`${label}: Gewicht in kg`}
                      className={cn(pillInput, "text-text w-11 px-1 text-right")}
                      {...invalid("weightKg")}
                      {...register(`${base}.sets.${s}.weightKg`, numberInput)}
                    />
                    <span aria-hidden="true">kg</span>
                  </span>
                  {showRir && (
                    <span className="bg-bg/60 text-muted inline-flex h-8 items-center gap-0.5 rounded-lg pr-0.5 pl-2 text-xs">
                      <span aria-hidden="true">RIR</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="–"
                        aria-label={`${label}: RIR`}
                        className={cn(pillInput, "text-text w-7")}
                        {...invalid("rir")}
                        {...register(`${base}.sets.${s}.rir`, numberInput)}
                      />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {sets.fields.length < MAX_EXERCISE_SETS && (
            <li className="flex">
              <button
                type="button"
                aria-label={`Satz zu ${name} hinzufügen`}
                onClick={addSet}
                className="border-border-strong/60 text-accent hover:border-accent flex min-h-28 flex-1 flex-col items-center justify-center gap-1 rounded-tile border-[1.5px] border-dashed text-sm font-medium"
              >
                <Plus aria-hidden="true" className="size-4" />
                Satz
                <span className="text-muted text-xs font-normal">kopiert den letzten</span>
              </button>
            </li>
          )}
        </ul>
        {(setErrors.length > 0 || setsError) && (
          <ul id={errorsId} className="text-danger flex flex-col gap-0.5 text-sm">
            {setsError && <li>{setsError}</li>}
            {setErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {showNote ? (
          <TextareaField
            label="Hinweis zur Ausführung"
            rows={2}
            placeholder="z. B. Tempo 3-1-1, Pause unten halten"
            error={error("notes")}
            {...register(`${base}.notes`)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="text-accent inline-flex h-8 items-center gap-1.5 self-start text-sm font-medium hover:underline"
          >
            <Pencil aria-hidden="true" className="size-4" /> Hinweis zur Ausführung
          </button>
        )}
      </div>
    </article>
  );
}
