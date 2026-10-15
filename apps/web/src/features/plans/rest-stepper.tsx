import { useFormContext } from "react-hook-form";

import { cn } from "@/lib/cn";
import { numberInput } from "@/lib/form-values";

import type { EditorValues } from "./editor-values";
import { pillInput } from "./set-fields";

const MAX_REST_SECONDS = 900;
const REST_STEP = 15;

interface RestStepperProps {
  /** Pfad der Übung, z. B. `days.0.exercises.1`. */
  base: `days.${number}.exercises.${number}`;
  inputId: string;
  /** Fehlermeldung zu `restSeconds`, steht beim Aufrufer unter der Zeile. */
  error: string | undefined;
  errorId: string;
}

/** Pause zwischen den Sätzen: Eingabe in Sekunden, dazu −/+ in 15-Sekunden-Schritten. */
export function RestStepper({ base, inputId, error, errorId }: RestStepperProps) {
  const { register, getValues, setValue } = useFormContext<EditorValues>();

  const changeRest = (step: number) => {
    const current = getValues(`${base}.restSeconds`);
    const valid = typeof current === "number" && Number.isFinite(current) ? current : null;
    let next: number | undefined;
    if (step > 0) next = Math.min((valid ?? 0) + step, MAX_REST_SECONDS);
    else next = valid === null || valid === 0 ? undefined : Math.max(valid + step, 0);
    setValue(`${base}.restSeconds`, next, { shouldDirty: true, shouldValidate: Boolean(error) });
  };

  return (
    <div className="bg-inset inline-flex items-center gap-0.5 rounded-card p-1">
      <label htmlFor={inputId} className="text-muted px-2 text-xs">
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
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="–"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
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
  );
}
