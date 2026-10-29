import type { WorkoutLog } from "@athletept/shared";
import { Check, MessageSquare, Minus, Star } from "lucide-react";

import { formatTarget } from "@/features/plans/format";
import { formatNumber } from "@/lib/format";

import { DeviatingBadge } from "./deviating-badge";
import { formatPerformed } from "./format";

function targetText(target: WorkoutLog["exercises"][number]["targets"][number] | undefined) {
  if (!target) return "–";
  return (
    [formatTarget(target), target.weightKg !== null ? `${formatNumber(target.weightKg)} kg` : null]
      .filter(Boolean)
      .join(" · ") || "Frei"
  );
}

/** Protokoll nur lesend: Vorgabe gegen geschafft, Bewertung und Kommentar. */
export function WorkoutView({ log }: { log: WorkoutLog }) {
  const deviating = log.exercises.filter((x) => x.deviating && !x.skipped).length;
  return (
    <div className="flex flex-col gap-4">
      {log.status === "skipped" ? (
        <section className="bg-surface rounded-card p-4" aria-label="Absage">
          <p className="font-medium">Training abgesagt.</p>
          <p className="text-muted mt-1 whitespace-pre-line">{log.notes ?? "Ohne Begründung."}</p>
        </section>
      ) : (
        <section
          className="bg-surface flex flex-col gap-3 rounded-card p-4"
          aria-label="Rückmeldung"
        >
          <p className="flex items-center gap-2">
            <Star aria-hidden="true" className="text-module-hints size-5" />
            {log.rating !== null ? (
              <span>
                Bewertung: <span className="font-medium">{log.rating} von 10</span>
              </span>
            ) : (
              <span className="text-muted">Keine Bewertung</span>
            )}
          </p>
          <p className="flex items-start gap-2">
            <MessageSquare aria-hidden="true" className="text-muted mt-0.5 size-5 shrink-0" />
            {log.notes ? (
              <span className="whitespace-pre-line">{log.notes}</span>
            ) : (
              <span className="text-muted">Kein Kommentar</span>
            )}
          </p>
          {deviating > 0 && (
            <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
              <DeviatingBadge />
              {deviating === 1 ? "1 Übung" : `${deviating} Übungen`} an anderem Gerät
            </p>
          )}
        </section>
      )}

      {log.exercises.map((exercise, index) => {
        const rows = Math.max(exercise.sets.length, exercise.targets.length);
        return (
          <section
            key={exercise.id}
            aria-labelledby={`view-${exercise.id}`}
            className="bg-surface flex flex-col gap-2 rounded-card p-4"
          >
            <h2 id={`view-${exercise.id}`} className="font-medium">
              <span className="text-muted tabular-nums">{index + 1}. </span>
              {exercise.exerciseName}
              {exercise.custom && (
                <span className="bg-inset text-muted ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-normal">
                  Spontan hinzugefügt
                </span>
              )}
              {exercise.deviating && !exercise.skipped && (
                <span className="ml-2 align-middle">
                  <DeviatingBadge />
                </span>
              )}
            </h2>
            {exercise.skipped ? (
              <p className="text-muted text-sm">Ausgelassen.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <caption className="sr-only">Sätze {exercise.exerciseName}</caption>
                  <colgroup>
                    <col className="w-16 sm:w-24" />
                    <col />
                    <col />
                  </colgroup>
                  <thead className="text-muted text-left">
                    <tr>
                      <th scope="col" className="py-1 pr-2 font-normal">
                        Satz
                      </th>
                      <th scope="col" className="py-1 pr-2 font-normal">
                        Vorgabe
                      </th>
                      <th scope="col" className="py-1 pr-2 font-normal">
                        Geschafft
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: rows }, (_, s) => {
                      const set = exercise.sets[s];
                      const target = exercise.targets[s];
                      return (
                        <tr key={s} className="border-border border-t">
                          <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                            {s + 1}
                            {target?.kind === "warmup" && (
                              <span className="text-muted"> · Aufw.</span>
                            )}
                          </th>
                          <td className="text-muted py-1.5 pr-2">{targetText(target)}</td>
                          <td className="py-1.5 pr-2">
                            {set?.done ? (
                              <span className="inline-flex items-center gap-1">
                                <Check aria-hidden="true" className="text-success size-4" />
                                {formatPerformed(set)}
                              </span>
                            ) : (
                              <span className="text-muted inline-flex items-center gap-1">
                                <Minus aria-hidden="true" className="size-4" />
                                nicht gemacht
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {exercise.notes && (
              <p className="text-sm whitespace-pre-line">
                <span className="text-muted">Notiz: </span>
                {exercise.notes}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
