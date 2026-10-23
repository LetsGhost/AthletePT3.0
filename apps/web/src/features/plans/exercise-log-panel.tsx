import type { ExerciseLogEntry } from "@athletept/shared";
import { History, MessageSquare, X } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { cn } from "@/lib/cn";
import { formatNumber, parseIsoDate } from "@/lib/format";

import { useExerciseLog } from "./api";
import { bestWeight, plannedRir, workingSets } from "./exercise-log";

const shortDate = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
const formatShort = (date: string) => shortDate.format(parseIsoDate(date));

interface ExerciseLogPanelProps {
  athleteId: string;
  /** `null`, wenn der Athlet selbst plant. */
  athleteName: string | null;
  exerciseId: string;
  exerciseName: string;
  onClose: () => void;
}

/**
 * Was der Athlet bei einer Übung zuletzt geschafft hat, damit man beim Planen sieht, was man
 * eintragen könnte: bestes Arbeitsgewicht je Einheit als Balken, darunter die Sätze und Notizen.
 */
export function ExerciseLogPanel({
  athleteId,
  athleteName,
  exerciseId,
  exerciseName,
  onClose,
}: ExerciseLogPanelProps) {
  const id = useId();
  const log = useExerciseLog(athleteId, exerciseId);

  return (
    <section
      aria-labelledby={id}
      className="bg-surface border-accent/40 flex flex-col gap-3 rounded-tile border p-4"
    >
      <div className="flex items-start gap-2.5">
        <span className="bg-accent/15 text-accent flex size-8 shrink-0 items-center justify-center rounded-full">
          <History aria-hidden="true" className="size-4" />
        </span>
        <h2 id={id} className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted text-xs font-normal">
            {athleteName ? `Protokoll von ${athleteName}` : "Dein Protokoll"}
          </span>
          <span className="truncate font-medium">{exerciseName}</span>
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted size-8"
          aria-label="Protokoll ausblenden"
          onClick={onClose}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <QueryState query={log} loading={<SkeletonList rows={2} className="h-20" />}>
        {({ items }) =>
          items.length === 0 ? (
            <p className="text-muted text-sm">Noch nie trainiert.</p>
          ) : (
            <>
              <WeightBars items={[...items].reverse()} />
              <h3 className="text-muted text-xs">Letzte Einheiten</h3>
              <ol className="flex flex-col">
                {items.map((entry, e) => {
                  const rir = plannedRir(entry);
                  return (
                    <li
                      // Eine Übung kann zweimal im selben Training vorkommen.
                      key={`${entry.logId}:${e}`}
                      className="border-border flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium tabular-nums">{formatShort(entry.date)}</span>
                        {rir !== null && (
                          <span className="text-muted text-xs">
                            RIR {rir} <span className="sr-only">geplant</span>
                          </span>
                        )}
                      </div>
                      <ul className="grid grid-cols-3 gap-1.5">
                        {workingSets(entry).map(({ set, below }, i) => (
                          <li
                            key={i}
                            className={cn(
                              "bg-inset flex flex-col items-center rounded-lg border px-1 py-1.5 text-center",
                              below ? "border-warning/60" : "border-transparent",
                            )}
                          >
                            <span className="text-muted text-[0.7rem]">Satz {i + 1}</span>
                            <span className="font-medium tabular-nums">
                              {set.weightKg !== null ? (
                                <>
                                  {formatNumber(set.weightKg)}{" "}
                                  <span className="text-muted text-xs font-normal">kg</span>
                                </>
                              ) : set.durationSeconds !== null ? (
                                `${set.durationSeconds} s`
                              ) : (
                                "–"
                              )}
                            </span>
                            {set.reps !== null && (
                              <span
                                className={cn(
                                  "text-xs tabular-nums",
                                  below ? "text-warning" : "text-muted",
                                )}
                              >
                                × {set.reps}
                              </span>
                            )}
                            {below && <span className="sr-only">unter der Vorgabe</span>}
                          </li>
                        ))}
                      </ul>
                      {entry.notes && (
                        <p className="text-muted flex gap-1.5 text-xs">
                          <MessageSquare aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                          {entry.notes}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          )
        }
      </QueryState>
    </section>
  );
}

/** Bestes Arbeitsgewicht je Einheit, älteste links. Ohne Gewichte (z. B. Klimmzüge) nichts. */
function WeightBars({ items }: { items: ExerciseLogEntry[] }) {
  const weights = items.map(bestWeight);
  const known = weights.filter((w): w is number => w !== null);
  if (known.length === 0) return null;
  const max = Math.max(...known);
  const change = known.length > 1 ? known[known.length - 1]! - known[0]! : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted">Arbeitsgewicht (bester Satz)</span>
        {change !== 0 && (
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-medium whitespace-nowrap",
              change > 0 ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
            )}
          >
            {change > 0 ? "↑ +" : "↓ −"}
            {formatNumber(Math.abs(change))} kg seit{" "}
            {formatShort(items[weights.findIndex((w) => w !== null)]!.date)}
          </span>
        )}
      </div>
      <ol className="flex h-24 items-end gap-2" aria-label="Arbeitsgewicht je Einheit">
        {items.map((entry, i) => {
          const weight = weights[i]!;
          const last = i === items.length - 1;
          return (
            <li
              key={`${entry.logId}:${i}`}
              className="flex h-full flex-1 flex-col items-center gap-1"
            >
              <span className="flex w-full flex-1 flex-col justify-end">
                <span className="text-center text-xs tabular-nums">
                  {weight !== null ? formatNumber(weight) : "–"}
                  <span className="sr-only"> kg am {formatShort(entry.date)}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn("w-full rounded-t-md", last ? "bg-accent" : "bg-inset")}
                  style={{ height: `${weight !== null ? Math.max((weight / max) * 60, 4) : 0}%` }}
                />
              </span>
              <span aria-hidden="true" className="text-muted text-[0.7rem] tabular-nums">
                {formatShort(entry.date)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
