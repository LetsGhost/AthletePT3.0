import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface CheckboxFieldProps extends Omit<ComponentProps<"input">, "id" | "type"> {
  label: ReactNode;
  /** Erklärung unter dem Label. Darf Links enthalten, sie liegen außerhalb des Labels. */
  description?: ReactNode;
  error?: string | undefined;
  /** `danger` für folgenreiche Schalter wie „Zugang sperren“. */
  tone?: "default" | "danger";
}

/** Checkbox mit Label, Erklärung und Fehlertext in einer hervorgehobenen Fläche. */
export function CheckboxField({
  label,
  description,
  error,
  tone = "default",
  className,
  ...props
}: CheckboxFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div
      className={cn(
        "bg-inset flex items-start gap-3 rounded-card border p-3",
        error ? "border-danger" : "border-transparent",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        aria-invalid={error ? true : undefined}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "mt-1 size-4 shrink-0",
          tone === "danger" ? "accent-danger" : "accent-primary",
        )}
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-muted text-sm">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
