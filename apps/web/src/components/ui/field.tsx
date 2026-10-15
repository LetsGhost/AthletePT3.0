import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface FieldControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

export interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  className?: string;
  /** Rendert das eigentliche Eingabeelement mit den nötigen ARIA-Attributen. */
  children: (control: FieldControlProps) => ReactNode;
}

/** Rahmen für alle Formularfelder: Label, Hinweis und Fehler sind mit dem Feld verknüpft. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-muted">
            {" "}
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })}
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
    </div>
  );
}
