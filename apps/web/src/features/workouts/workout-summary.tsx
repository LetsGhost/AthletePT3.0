import type { CompleteWorkoutResponse } from "@athletept/shared";
import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

import { formatWorkoutDuration } from "./format";
import { NewRecords } from "./new-records";

/** Erledigte Sätze und Volumen (kg × Wdh.) ohne ausgelassene Übungen. */
function summarize(log: CompleteWorkoutResponse) {
  let sets = 0;
  let volume = 0;
  for (const exercise of log.exercises) {
    if (exercise.skipped) continue;
    for (const set of exercise.sets) {
      if (!set.done) continue;
      sets += 1;
      volume += (set.weightKg ?? 0) * (set.reps ?? 0);
    }
  }
  const end = Date.parse(log.completedAt ?? log.startedAt);
  const seconds = (end - Date.parse(log.startedAt)) / 1000;
  return { sets, volume, seconds };
}

/** Abschluss-Bildschirm nach „Training abschließen“. */
export function WorkoutSummary({ log }: { log: CompleteWorkoutResponse }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { sets, volume, seconds } = summarize(log);
  const stats = [
    { label: "Sätze", value: String(sets) },
    { label: "Volumen", value: volume > 0 ? `${formatNumber(Math.round(volume))} kg` : "–" },
    { label: "Dauer", value: formatWorkoutDuration(seconds) },
  ];

  // Fokus auf die Überschrift: Screenreader erfahren vom Abschluss, die Seite scrollt nach oben.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8 text-center">
      <title>Training abgeschlossen · AthletePT</title>
      <span className="bg-primary text-on-primary flex size-16 items-center justify-center rounded-full">
        <Check aria-hidden="true" className="size-8" strokeWidth={2.6} />
      </span>
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-medium outline-none">
          Training abgeschlossen
        </h1>
        <p className="text-muted mt-1">Stark! {log.dayName} ist an deinen Coach übermittelt.</p>
      </div>
      <dl className="grid w-full grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface flex flex-col-reverse rounded-card p-3">
            <dt className="text-muted text-xs">{stat.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <div className="w-full">
        <NewRecords records={log.newRecords} />
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button asChild size="lg">
          <Link to="/dashboard">Zur Übersicht</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/workouts">Zum Verlauf</Link>
        </Button>
      </div>
    </div>
  );
}
