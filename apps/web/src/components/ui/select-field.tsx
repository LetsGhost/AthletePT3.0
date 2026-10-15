import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Field } from "./field";
import { inputClasses } from "./input-classes";

interface SelectFieldProps extends Omit<ComponentProps<"select">, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  /** Text für die leere Auswahl. Ohne Angabe gibt es keine leere Option. */
  placeholder?: string;
}

/** Natives Select: am Handy die beste Bedienung, ohne Extra-Code barrierefrei. */
export function SelectField({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required} className={className}>
      {(control) => (
        <div className="relative">
          <select {...control} className={cn(inputClasses, "appearance-none pr-10")} {...props}>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="text-muted pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2"
          />
        </div>
      )}
    </Field>
  );
}
