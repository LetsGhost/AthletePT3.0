import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Field } from "./field";
import { inputClasses } from "./input-classes";

export interface TextFieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  /** Hilfetext unter dem Feld. */
  hint?: ReactNode;
  error?: string | undefined;
  /** Element rechts im Feld, z. B. ein Einheiten-Text oder Button. */
  trailing?: ReactNode;
}

/** Beschriftetes Eingabefeld mit verknüpftem Hinweis- und Fehlertext. */
export function TextField({ label, hint, error, trailing, className, ...props }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required} className={className}>
      {(control) => (
        <div className="relative">
          <input {...control} className={cn(inputClasses, trailing && "pr-12")} {...props} />
          {trailing && (
            <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>
          )}
        </div>
      )}
    </Field>
  );
}

export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
          aria-pressed={visible}
          className="text-muted hover:text-text flex h-11 w-11 items-center justify-center rounded-card"
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
    />
  );
}

/** Zahlenfeld mit Einheit (z. B. „kg“). Liefert Text; Umwandlung übernimmt `register(..., numberInput)`. */
export function NumberField({
  unit,
  ...props
}: Omit<TextFieldProps, "type" | "trailing"> & { unit?: string }) {
  return (
    <TextField
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...props}
      trailing={unit ? <span className="text-muted pr-3 text-sm">{unit}</span> : undefined}
    />
  );
}
