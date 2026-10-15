import { MAX_WARMUP_ITEMS, type Exercise } from "@athletept/shared";
import { Flame, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { get, useFieldArray, useFormContext, useWatch, type FieldError } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import { cn } from "@/lib/cn";

import type { InfoMap } from "./editor-helpers";
import type { EditorValues } from "./editor-values";

/** Warm-up als Chips. Neue Einträge: Katalog-Übung wählen oder Freitext, dazu Details. */
export function WarmupEditor({
  base,
  infos,
  dayName,
  onPick,
}: {
  base: `days.${number}`;
  infos: InfoMap;
  dayName: string;
  onPick: (exercise: Exercise) => void;
}) {
  const id = useId();
  const {
    control,
    formState: { errors },
  } = useFormContext<EditorValues>();
  const warmup = useFieldArray({ control, name: `${base}.warmup`, keyName: "key" });
  const items = useWatch({ control, name: `${base}.warmup` }) ?? [];
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [picked, setPicked] = useState<Exercise | null>(null);
  const error = (path: string) =>
    (get(errors, `${base}.warmup.${path}`) as FieldError | undefined)?.message;
  const canAdd = picked !== null || name.trim().length >= 2;

  const add = () => {
    if (picked) {
      onPick(picked);
      warmup.append({ exerciseId: picked.id, name: picked.name, details: details.trim() });
    } else if (name.trim().length >= 2) {
      warmup.append({ exerciseId: null, name: name.trim(), details: details.trim() });
    } else {
      return;
    }
    setName("");
    setDetails("");
    setPicked(null);
  };

  const itemErrors = warmup.fields.flatMap((_, w) =>
    ["exerciseId", "name", "details"].flatMap((path) => {
      const message = error(`${w}.${path}`);
      return message ? [message] : [];
    }),
  );

  return (
    <div className="flex flex-wrap items-start gap-3">
      <span
        id={`${id}-label`}
        className="text-muted inline-flex w-20 items-center gap-1.5 pt-2 text-sm"
      >
        <Flame aria-hidden="true" className="text-module-checkin size-3.5" /> Warm-up
      </span>
      <div className="flex min-w-64 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {warmup.fields.length > 0 && (
            <ul aria-labelledby={`${id}-label`} className="contents">
              {warmup.fields.map((field, w) => {
                const item = items[w];
                const fromCatalog = Boolean(item?.exerciseId);
                const info = fromCatalog ? infos[item!.exerciseId!] : undefined;
                const label = (fromCatalog ? info?.name : item?.name) || `Eintrag ${w + 1}`;
                const invalid = ["exerciseId", "name", "details"].some((path) =>
                  error(`${w}.${path}`),
                );
                return (
                  <li
                    key={field.key}
                    className={cn(
                      "bg-inset inline-flex h-9 items-center gap-2 rounded-card border pr-1 pl-3 text-sm",
                      invalid ? "border-danger" : "border-border",
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    {info?.archived && <Badge tone="warning">Archiviert</Badge>}
                    {item?.details && <span className="text-muted">{item.details}</span>}
                    <button
                      type="button"
                      aria-label={`${label} aus dem Warm-up entfernen`}
                      onClick={() => warmup.remove(w)}
                      className="text-muted hover:text-text flex size-7 items-center justify-center rounded-lg"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {warmup.fields.length < MAX_WARMUP_ITEMS && (
            <div className="flex flex-wrap items-center gap-1.5">
              <ExercisePicker
                label={`Warm-up-Übung für ${dayName}`}
                hideLabel
                placeholder="Übung"
                className="w-44"
                inputClassName="h-9 text-sm"
                value={name}
                onValueChange={(value) => {
                  setName(value);
                  setPicked(null);
                }}
                excludeIds={items.flatMap((item) => (item.exerciseId ? [item.exerciseId] : []))}
                onSelect={(exercise) => {
                  setPicked(exercise);
                  setName(exercise.name);
                }}
                onCreate={(text) => setName(text)}
                createLabel={(text) => `„${text}“ als Freitext verwenden`}
              />
              <input
                type="text"
                autoComplete="off"
                aria-label={`Details zum Warm-up für ${dayName}`}
                placeholder="z. B. 5 min locker"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    add();
                  }
                }}
                className={cn(inputClasses, "h-9 w-36 text-sm")}
              />
              <Button
                variant="secondary"
                size="icon"
                className="text-accent size-9"
                aria-label="Warm-up hinzufügen"
                disabled={!canAdd}
                onClick={add}
              >
                <Plus aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}
        </div>
        {itemErrors.length > 0 && (
          <ul className="text-danger flex flex-col gap-0.5 text-sm">
            {itemErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
