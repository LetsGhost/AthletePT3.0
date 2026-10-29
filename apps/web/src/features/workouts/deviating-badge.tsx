import { Shuffle } from "lucide-react";

/** Übung an anderem Gerät/Gym. Gestrichelt statt Warnfarbe: ein Hinweis, kein Fehler. */
export function DeviatingBadge() {
  return (
    <span className="text-muted border-border-strong inline-flex items-center gap-1 rounded-full border border-dashed px-2 text-xs leading-normal font-medium whitespace-nowrap">
      <Shuffle aria-hidden="true" className="size-3" />
      Abweichend
    </span>
  );
}
