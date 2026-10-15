import { X } from "lucide-react";
import { get, useFormContext, useWatch, type FieldError } from "react-hook-form";

import { cn } from "@/lib/cn";
import { numberInput } from "@/lib/form-values";

import type { EditorValues } from "./editor-values";
import { pillInput, setFields, tileInput, type SetMode } from "./set-fields";

interface SetTileProps {
  /** Pfad des Satzes, z. B. `days.0.exercises.1.sets.2`. */
  base: `days.${number}.exercises.${number}.sets.${number}`;
  mode: SetMode;
  badge: string | undefined;
  label: string;
  canRemove: boolean;
  /** ID der Fehlerliste unter den Kacheln (für `aria-describedby`). */
  errorsId: string;
  onToggleKind: () => void;
  onRemove: () => void;
}

/** Ein Satz als Kachel: Art (Aufwärmen/Arbeitssatz), Wiederholungen oder Dauer, Gewicht, RIR. */
export function SetTile({
  base,
  mode,
  badge,
  label,
  canRemove,
  errorsId,
  onToggleKind,
  onRemove,
}: SetTileProps) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<EditorValues>();
  const set = useWatch({ control, name: base });
  const warmup = set?.kind === "warmup";
  const hasError = (field: string) =>
    Boolean((get(errors, `${base}.${field}`) as FieldError | undefined)?.message);
  const invalid = (field: (typeof setFields)[number]) =>
    hasError(field) ? { "aria-invalid": true as const, "aria-describedby": errorsId } : {};
  const showTo = !warmup || (typeof set?.repsMax === "number" && set.repsMax !== set.repsMin);
  const showRir = !warmup || typeof set?.rir === "number";

  return (
    <li
      className={cn(
        "bg-inset flex flex-col gap-1.5 rounded-tile border py-2 pr-1.5 pl-2.5",
        setFields.some(hasError) ? "border-danger" : warmup ? "border-warning/30" : "border-border",
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
          {badge}
        </span>
        <button
          type="button"
          aria-label={`${label}: Art wechseln, jetzt ${warmup ? "Aufwärmsatz" : "Arbeitssatz"}`}
          onClick={onToggleKind}
          className={cn(
            "h-6 rounded-md px-2 text-xs font-medium",
            warmup ? "bg-warning/15 text-warning" : "bg-surface text-muted hover:text-text",
          )}
        >
          {warmup ? "Aufwärmen" : "Arbeitssatz"}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          aria-label={`${label} entfernen`}
          disabled={!canRemove}
          onClick={onRemove}
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
            {...register(`${base}.repsMin`, numberInput)}
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
                {...register(`${base}.repsMax`, numberInput)}
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
            {...register(`${base}.durationSeconds`, numberInput)}
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
            {...register(`${base}.weightKg`, numberInput)}
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
              {...register(`${base}.rir`, numberInput)}
            />
          </span>
        )}
      </div>
    </li>
  );
}
