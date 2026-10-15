import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Field } from "./field";
import { inputClasses } from "./input-classes";

interface TextareaFieldProps extends Omit<ComponentProps<"textarea">, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
}

export function TextareaField({
  label,
  hint,
  error,
  className,
  rows = 3,
  ...props
}: TextareaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required} className={className}>
      {(control) => (
        <textarea
          {...control}
          rows={rows}
          className={cn(inputClasses, "h-auto min-h-20 resize-y py-2.5")}
          {...props}
        />
      )}
    </Field>
  );
}
