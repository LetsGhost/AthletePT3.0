import type { Exercise } from "@athletept/shared";
import { Plus, Search } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { inputClasses } from "@/components/ui/input-classes";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { useExerciseSearch } from "./api";
import { muscleSummary } from "./labels";

interface ExercisePickerProps {
  label: string;
  onSelect: (exercise: Exercise) => void;
  /** Bereits gewählte Übungen, die nicht noch einmal angeboten werden. */
  excludeIds?: readonly string[];
  /** Bietet am Ende der Liste „Neue Übung anlegen“ mit dem eingegebenen Namen an. */
  onCreate?: (name: string) => void;
  /** Text der „Anlegen“-Option. Standard: „„Name“ als neue Übung anlegen“. */
  createLabel?: (name: string) => string;
  placeholder?: string;
  /** Beschriftung nur für Screenreader (das Feld steht für sich, z. B. in einer Zeile). */
  hideLabel?: boolean;
  /**
   * Gesteuerter Text: Mit `value` bleibt der Text nach der Auswahl stehen, die Seite setzt ihn
   * selbst (z. B. auf den Namen der gewählten Übung).
   */
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  inputClassName?: string;
}

/**
 * Übungsauswahl mit Autovervollständigung (ARIA-Combobox). Pfeiltasten wählen, Enter übernimmt,
 * Escape schließt bzw. leert. Nach der Auswahl ist das Feld leer für die nächste Übung.
 */
export function ExercisePicker({
  label,
  onSelect,
  excludeIds = [],
  onCreate,
  createLabel = (name) => `„${name}“ als neue Übung anlegen`,
  placeholder = "Übung suchen, z. B. Kniebeuge",
  hideLabel = false,
  value,
  onValueChange,
  className,
  inputClassName,
}: ExercisePickerProps) {
  const id = useId();
  const listId = `${id}-list`;
  const statusId = `${id}-status`;
  const [ownInput, setOwnInput] = useState("");
  const controlled = value !== undefined;
  const input = controlled ? value : ownInput;
  const setInput = (next: string) => {
    if (!controlled) setOwnInput(next);
    onValueChange?.(next);
  };
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const term = useDebouncedValue(input.trim(), 200);
  const search = useExerciseSearch(term ? { search: term } : {}, { enabled: open });
  const items = (search.data?.items ?? []).filter((item) => !excludeIds.includes(item.id));
  const canCreate = Boolean(onCreate && input.trim().length >= 2);
  const optionCount = items.length + (canCreate ? 1 : 0);
  const activeIndex = Math.min(active, Math.max(optionCount - 1, 0));
  const optionId = (index: number) => `${id}-option-${index}`;

  const close = () => {
    setOpen(false);
    setActive(0);
  };

  const choose = (index: number) => {
    const exercise = items[index];
    if (exercise) {
      onSelect(exercise);
    } else if (canCreate) {
      onCreate?.(input.trim());
    } else {
      return;
    }
    if (!controlled) setInput("");
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive((activeIndex + 1) % Math.max(optionCount, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) setActive((activeIndex - 1 + optionCount) % Math.max(optionCount, 1));
        break;
      case "Enter":
        if (open && optionCount > 0) {
          event.preventDefault();
          choose(activeIndex);
        }
        break;
      case "Escape":
        if (open) close();
        else setInput("");
        break;
    }
  };

  let status = "";
  if (open) {
    if (search.isPending || (search.isFetching && items.length === 0)) status = "Suche läuft …";
    else if (search.isError) status = "Übungen konnten nicht geladen werden.";
    else if (items.length === 0) status = "Keine passende Übung gefunden.";
    else status = items.length === 1 ? "1 Übung gefunden." : `${items.length} Übungen gefunden.`;
  }

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-describedby={statusId}
          aria-activedescendant={open && optionCount > 0 ? optionId(activeIndex) : undefined}
          placeholder={placeholder}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={close}
          className={cn(inputClasses, "pl-10", inputClassName)}
        />
        {open && search.isFetching && (
          <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />
        )}
      </div>
      <p id={statusId} role="status" className="sr-only">
        {status}
      </p>
      {open && (
        <div className="bg-surface border-border absolute top-full right-0 left-0 z-30 mt-1 min-w-64 overflow-hidden rounded-card border shadow-xl">
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="max-h-80 overflow-y-auto py-1"
          >
            {items.map((exercise, index) => (
              // Tastatur läuft über das Eingabefeld (aria-activedescendant), Optionen erhalten keinen Fokus.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={exercise.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                // Verhindert, dass das Feld vor dem Klick den Fokus verliert und die Liste schließt.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer flex-col px-3 py-2",
                  index === activeIndex && "bg-inset",
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  {exercise.name}
                  {exercise.scope === "own" && <Badge tone="success">Eigene</Badge>}
                </span>
                <span className="text-muted text-sm">{muscleSummary(exercise)}</span>
              </li>
            ))}
            {canCreate && (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                id={optionId(items.length)}
                role="option"
                aria-selected={activeIndex === items.length}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(items.length)}
                onMouseMove={() => setActive(items.length)}
                className={cn(
                  "text-accent flex cursor-pointer items-center gap-2 px-3 py-2 font-medium",
                  activeIndex === items.length && "bg-inset",
                )}
              >
                <Plus aria-hidden="true" className="size-4" />
                {createLabel(input.trim())}
              </li>
            )}
          </ul>
          {optionCount === 0 && <p className="text-muted px-3 py-3 text-sm">{status}</p>}
        </div>
      )}
    </div>
  );
}
