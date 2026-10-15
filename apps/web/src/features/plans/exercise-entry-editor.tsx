import { setKindLabels, setKinds } from "@athletept/shared";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { get, useFieldArray, useFormContext, type FieldError } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { NumberField, TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { cn } from "@/lib/cn";
import { numberInput } from "@/lib/form-values";

import { emptySet, type EditorSet, type EditorValues, type ExerciseInfo } from "./editor-values";
import { parseSetShorthand } from "./format";

type Mode = "reps" | "duration";

const cellInput = cn(inputClasses, "h-9 min-w-16 px-2");

interface ExerciseEntryEditorProps {
  dayIndex: number;
  index: number;
  count: number;
  /** Fehlt nur, wenn die Übung noch nicht geladen ist. */
  info: ExerciseInfo | undefined;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/** Eine Übung im Trainingstag: Sätze, Pause, Hinweise. */
export function ExerciseEntryEditor({
  dayIndex,
  index,
  count,
  info,
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
  const [mode, setMode] = useState<Mode>(() =>
    (getValues(`${base}.sets`) ?? []).some((set) => typeof set.durationSeconds === "number")
      ? "duration"
      : "reps",
  );
  const [shorthand, setShorthand] = useState("");
  const [shorthandError, setShorthandError] = useState<string | null>(null);

  const name = info?.name ?? "Übung";
  const error = (path: string) =>
    (get(errors, `${base}.${path}`) as FieldError | undefined)?.message;

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

  const addSet = () => {
    const last = (getValues(`${base}.sets`) ?? []).at(-1);
    sets.append(last ? { ...last } : emptySet());
  };

  const setErrors = sets.fields.flatMap((_, s) =>
    (["repsMin", "repsMax", "durationSeconds", "weightKg", "rir"] as const).flatMap((field) => {
      const message = error(`sets.${s}.${field}`);
      return message ? [`Satz ${s + 1}: ${message}`] : [];
    }),
  );
  const setsError =
    error("sets") ?? (get(errors, `${base}.sets.root`) as FieldError | undefined)?.message;
  const errorsId = `${id}-set-errors`;

  return (
    <div className="border-border flex flex-col gap-4 rounded-card border p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="flex flex-wrap items-center gap-2 font-medium">
            <span className="text-muted tabular-nums">{index + 1}.</span>
            {name}
            {info?.archived && <Badge tone="warning">Archiviert</Badge>}
            {info && !info.archived && !info.selectable && (
              <Badge tone="neutral">Nicht in deinem Katalog</Badge>
            )}
          </h4>
          {error("exerciseId") && <p className="text-danger text-sm">{error("exerciseId")}</p>}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${name} nach oben`}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${name} nach unten`}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-danger"
            aria-label={`${name} entfernen`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-sm font-medium">
            Vorgabe
          </span>
          <SegmentedControl
            label={`Vorgabe für ${name}`}
            className="bg-inset"
            options={[
              { value: "reps", label: "Wiederholungen" },
              { value: "duration", label: "Dauer" },
            ]}
            value={mode}
            onChange={switchMode}
          />
        </div>
        <NumberField
          label="Pause"
          unit="s"
          className="w-32"
          error={error("restSeconds")}
          {...register(`${base}.restSeconds`, numberInput)}
        />
        <div className="flex min-w-60 flex-1 items-end gap-2">
          <TextField
            label="Schnelleingabe Arbeitssätze"
            placeholder="z. B. 3 × 8–10 @ 80 kg RIR 2"
            autoComplete="off"
            className="flex-1"
            value={shorthand}
            error={shorthandError ?? undefined}
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
          <Button
            variant="secondary"
            className={cn(shorthandError && "mb-7")}
            disabled={!shorthand.trim()}
            onClick={applyShorthand}
          >
            Übernehmen
          </Button>
        </div>
      </div>

      {/* relative: sonst ragen absolut positionierte sr-only-Texte aus dem Scrollbereich. */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Sätze für {name}</caption>
          <thead>
            <tr className="text-muted text-left">
              <th scope="col" className="w-8 px-1 pb-1 font-medium">
                #
              </th>
              <th scope="col" className="px-1 pb-1 font-medium">
                Art
              </th>
              {mode === "reps" ? (
                <>
                  <th scope="col" className="px-1 pb-1 font-medium">
                    Wdh. von
                  </th>
                  <th scope="col" className="px-1 pb-1 font-medium">
                    Wdh. bis
                  </th>
                </>
              ) : (
                <th scope="col" className="px-1 pb-1 font-medium">
                  Dauer (s)
                </th>
              )}
              <th scope="col" className="px-1 pb-1 font-medium">
                Gewicht (kg)
              </th>
              <th scope="col" className="px-1 pb-1 font-medium">
                RIR
              </th>
              <th scope="col" className="px-1 pb-1">
                <span className="sr-only">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sets.fields.map((field, s) => {
              const label = (column: string) => `Satz ${s + 1}: ${column}`;
              const invalid = (path: string) =>
                error(`sets.${s}.${path}`)
                  ? { "aria-invalid": true as const, "aria-describedby": errorsId }
                  : {};
              const numberCell = (
                path: "repsMin" | "repsMax" | "durationSeconds" | "weightKg" | "rir",
                column: string,
              ) => (
                <td className="px-1 py-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={label(column)}
                    className={cellInput}
                    {...invalid(path)}
                    {...register(`${base}.sets.${s}.${path}`, numberInput)}
                  />
                </td>
              );
              return (
                <tr key={field.key}>
                  <td className="text-muted px-1 py-1 tabular-nums">{s + 1}</td>
                  <td className="px-1 py-1">
                    <select
                      aria-label={label("Art")}
                      className={cn(cellInput, "min-w-32")}
                      {...register(`${base}.sets.${s}.kind`)}
                    >
                      {setKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {setKindLabels[kind]}
                        </option>
                      ))}
                    </select>
                  </td>
                  {mode === "reps" ? (
                    <>
                      {numberCell("repsMin", "Wiederholungen von")}
                      {numberCell("repsMax", "Wiederholungen bis")}
                    </>
                  ) : (
                    numberCell("durationSeconds", "Dauer in Sekunden")
                  )}
                  {numberCell("weightKg", "Gewicht in kg")}
                  {numberCell("rir", "RIR")}
                  <td className="px-1 py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label={label("entfernen")}
                      disabled={sets.fields.length === 1}
                      onClick={() => sets.remove(s)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(setErrors.length > 0 || setsError) && (
        <ul id={errorsId} className="text-danger flex flex-col gap-0.5 text-sm">
          {setsError && <li>{setsError}</li>}
          {setErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="ghost" size="sm" disabled={sets.fields.length >= 10} onClick={addSet}>
          <Plus aria-hidden="true" className="size-4" /> Satz hinzufügen
        </Button>
      </div>

      <TextareaField
        label="Hinweise zur Ausführung"
        rows={2}
        placeholder="z. B. Tempo 3-1-1, Pause unten halten"
        error={error("notes")}
        {...register(`${base}.notes`)}
      />
    </div>
  );
}
