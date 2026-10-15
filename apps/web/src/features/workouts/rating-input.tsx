import { useId } from "react";

import { cn } from "@/lib/cn";

const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface RatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Bewertung 1–10 als native Radiogruppe (Pfeiltasten, Screenreader), optional. */
export function RatingInput({ value, onChange }: RatingInputProps) {
  const name = useId();
  const hintId = `${name}-hint`;
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={hintId}>
      <legend className="text-sm font-medium">Wie war das Training?</legend>
      <p id={hintId} className="text-muted -mt-1 text-sm">
        1 = sehr schlecht, 10 = super. Optional.
      </p>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {values.map((rating) => (
          <label
            key={rating}
            className={cn(
              "border-border-strong flex h-11 cursor-pointer items-center justify-center rounded-card border font-medium tabular-nums",
              "has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2",
              value === rating ? "bg-primary text-on-primary border-primary" : "bg-inset",
            )}
          >
            <input
              type="radio"
              name={name}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
              className="sr-only"
            />
            {rating}
          </label>
        ))}
      </div>
      {value !== null && (
        <button
          type="button"
          className="text-accent min-h-11 self-start text-sm underline-offset-4 hover:underline"
          onClick={() => onChange(null)}
        >
          Bewertung entfernen
        </button>
      )}
    </fieldset>
  );
}
