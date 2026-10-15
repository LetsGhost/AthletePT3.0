import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ChipGroup<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
}

interface ChipCheckboxGroupProps<T extends string> {
  legend: string;
  groups: readonly ChipGroup<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** Nicht wählbare Werte, z. B. weil sie schon an anderer Stelle gewählt sind. */
  disabledValues?: readonly T[];
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
}

/** Mehrfachauswahl als Chips. Echte Checkboxen, also mit Tastatur und Screenreader bedienbar. */
export function ChipCheckboxGroup<T extends string>({
  legend,
  groups,
  value,
  onChange,
  disabledValues = [],
  hint,
  error,
  required,
}: ChipCheckboxGroupProps<T>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const toggle = (option: T, checked: boolean) =>
    onChange(checked ? [...value, option] : value.filter((v) => v !== option));

  return (
    <fieldset
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      className="flex flex-col gap-2"
    >
      <legend className="mb-1.5 text-sm font-medium">
        {legend}
        {required && (
          <span aria-hidden="true" className="text-muted">
            {" "}
            *
          </span>
        )}
      </legend>
      {groups.map((group) => (
        <div
          key={group.label}
          role="group"
          aria-label={group.label}
          className="flex flex-col gap-1.5"
        >
          <p aria-hidden="true" className="text-muted text-xs">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const checked = value.includes(option.value);
              const disabled = !checked && disabledValues.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                    "has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                    checked
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-inset border-border-strong",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) => toggle(option.value, event.target.checked)}
                  />
                  {checked && <Check aria-hidden="true" className="size-4" />}
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {hint && (
        <p id={hintId} className="text-muted text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-danger text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
