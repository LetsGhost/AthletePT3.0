import { MAX_PLAN_DAYS } from "@athletept/shared";
import { Plus } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { get, useFormContext } from "react-hook-form";

import { cn } from "@/lib/cn";

import { plural, shortWeekday, workingSets } from "./editor-helpers";
import type { EditorDay, EditorValues } from "./editor-values";

interface DayTabsProps {
  /** Schlüssel der Tage aus `useFieldArray`. */
  keys: readonly string[];
  days: readonly (Partial<EditorDay> | undefined)[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  tabId: (index: number) => string;
  panelId: (index: number) => string;
}

/** Trainingstage als Tabs (Pfeiltasten, Pos1/Ende) mit Kurzinfo, dazu „Tag hinzufügen“. */
export function DayTabs({
  keys,
  days,
  activeIndex,
  onSelect,
  onAdd,
  tabId,
  panelId,
}: DayTabsProps) {
  const {
    formState: { errors },
  } = useFormContext<EditorValues>();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const count = keys.length;
    const next = {
      ArrowRight: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {keys.length > 0 && (
        <div role="tablist" aria-label="Trainingstage" className="flex gap-2.5">
          {keys.map((key, d) => {
            const day = days[d];
            const selected = d === activeIndex;
            const exerciseCount = day?.exercises?.length ?? 0;
            const setCount = (day?.exercises ?? []).reduce(
              (sum, entry) => sum + workingSets(entry.sets),
              0,
            );
            const hasErrors = Boolean(get(errors, `days.${d}`));
            return (
              <button
                key={key}
                ref={(element) => {
                  tabRefs.current[d] = element;
                }}
                id={tabId(d)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(d)}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(d)}
                onKeyDown={(event) => onKeyDown(event, d)}
                className={cn(
                  "flex w-48 shrink-0 flex-col gap-1.5 rounded-tile border px-3.5 py-3 text-left transition-colors",
                  selected
                    ? "bg-surface border-accent/60 shadow-[inset_0_-3px_0_var(--accent)]"
                    : "bg-surface/50 border-border hover:bg-surface",
                  hasErrors && "border-danger",
                )}
              >
                <span className="text-muted flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    Tag {d + 1}
                    {hasErrors && (
                      <>
                        <span aria-hidden="true" className="bg-danger size-2 rounded-full" />
                        <span className="sr-only">, enthält Fehler</span>
                      </>
                    )}
                  </span>
                  <span className="bg-inset text-text rounded-md px-1.5 py-px font-medium">
                    {day?.weekday ? shortWeekday(day.weekday) : "Flexibel"}
                  </span>
                </span>
                <span className="truncate font-medium">{day?.name?.trim() || "Ohne Namen"}</span>
                <span className="text-muted text-xs">
                  {plural(exerciseCount, "Übung", "Übungen")} · {plural(setCount, "Satz", "Sätze")}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {keys.length < MAX_PLAN_DAYS && (
        <button
          type="button"
          onClick={onAdd}
          className="border-border-strong/60 text-accent hover:border-accent flex w-36 shrink-0 flex-col items-center justify-center gap-1 rounded-tile border-[1.5px] border-dashed py-3 text-sm font-medium"
        >
          <Plus aria-hidden="true" className="size-4" /> Tag hinzufügen
        </button>
      )}
    </div>
  );
}
