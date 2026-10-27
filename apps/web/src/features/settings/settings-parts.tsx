import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Abschnitt mit kleiner Überschrift und gruppierten Zeilen darunter. */
export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted px-1 text-xs font-semibold tracking-wider uppercase">{title}</h2>
      <div className="bg-surface divide-border flex flex-col divide-y overflow-hidden rounded-tile">
        {children}
      </div>
      {footer && <p className="text-muted px-1 text-xs leading-relaxed">{footer}</p>}
    </section>
  );
}

/** Farbige Icon-Kachel am Zeilenanfang. */
export function RowIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        "bg-accent/12 text-accent flex size-9 shrink-0 items-center justify-center rounded-lg",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

/** Zeilentext mit optionaler Unterzeile. */
export function RowText({ id, title, sub }: { id?: string; title: string; sub?: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span id={id} className="text-sm font-medium">
        {title}
      </span>
      {sub && <span className="text-muted text-xs">{sub}</span>}
    </span>
  );
}

export const rowClasses = "flex w-full items-center gap-3 p-3.5 text-left";

export function Switch({
  checked,
  onChange,
  labelledBy,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-7.5 w-12.5 shrink-0 rounded-full p-0.75 transition-colors",
        checked ? "bg-primary" : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "size-6 rounded-full bg-white transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
