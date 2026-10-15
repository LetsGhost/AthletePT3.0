import type { PlanDay, PlanExerciseInfo } from "@athletept/shared";
import { Flame, Info, Timer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ExerciseDetailsDialog } from "@/features/exercises/exercise-details-dialog";
import { cn } from "@/lib/cn";

import { formatRest, formatSetGroup, groupSets, weekdayLabel } from "./format";
import { PlanTypeBadge } from "./plan-type-badge";

/** Warm-up und Übungen eines Tages, nur lesend. `level`: Überschriften-Ebene der Abschnitte. */
export function DayContent({
  day,
  exercises,
  level = "h3",
}: {
  day: PlanDay;
  exercises: readonly PlanExerciseInfo[];
  level?: "h2" | "h3";
}) {
  const Section = level;
  const Item = level === "h2" ? "h3" : "h4";
  const [details, setDetails] = useState<PlanExerciseInfo | null>(null);
  const info = (id: string | null) => (id ? exercises.find((x) => x.id === id) : undefined);

  const detailsButton = (exerciseId: string | null, name: string) => {
    const exercise = info(exerciseId);
    if (!exercise) return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        aria-label={`Anleitung zu ${name}`}
        onClick={() => setDetails(exercise)}
      >
        <Info aria-hidden="true" className="size-4" /> Anleitung
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {day.warmup.length > 0 && (
        <section aria-label="Warm-up" className="flex flex-col gap-2">
          <Section className="flex items-center gap-2 font-medium">
            <Flame aria-hidden="true" className="text-module-hints size-4" /> Warm-up
          </Section>
          <ul className="flex flex-col gap-1">
            {day.warmup.map((item) => (
              <li key={item.id} className="bg-inset flex items-center gap-2 rounded-card px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{item.name}</span>
                  {item.details && <span className="text-muted block text-sm">{item.details}</span>}
                </span>
                {detailsButton(item.exerciseId, item.name)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Übungen" className="flex flex-col gap-2">
        <Section className="font-medium">Übungen</Section>
        <ol className="flex flex-col gap-2">
          {day.exercises.map((entry, index) => (
            <li key={entry.id} className="bg-inset flex flex-col gap-2 rounded-card p-3">
              <div className="flex items-start gap-2">
                <Item className="min-w-0 flex-1 font-medium">
                  <span className="text-muted tabular-nums">{index + 1}. </span>
                  {entry.exerciseName}
                </Item>
                {detailsButton(entry.exerciseId, entry.exerciseName)}
              </div>
              <ul className="flex flex-col gap-0.5 text-sm">
                {groupSets(entry.sets).map((group, g) => (
                  <li key={g} className={cn(group.kind === "warmup" && "text-muted")}>
                    {group.kind === "warmup" ? "Aufwärmen: " : ""}
                    {formatSetGroup(group)}
                  </li>
                ))}
              </ul>
              {entry.restSeconds !== null && (
                <p className="text-muted flex items-center gap-1 text-sm">
                  <Timer aria-hidden="true" className="size-4" /> {formatRest(entry.restSeconds)}
                </p>
              )}
              {entry.notes && <p className="text-sm whitespace-pre-line">{entry.notes}</p>}
            </li>
          ))}
        </ol>
      </section>

      {details && (
        <ExerciseDetailsDialog
          exercise={details}
          onOpenChange={(open) => !open && setDetails(null)}
        />
      )}
    </div>
  );
}

interface ViewContent {
  notes: string | null;
  days: PlanDay[];
  exercises: PlanExerciseInfo[];
}

/** Ganzer Plan nur lesend, z. B. archivierte Pläne und frühere Versionen. */
export function PlanView({ content }: { content: ViewContent }) {
  return (
    <div className="flex flex-col gap-4">
      {content.notes && (
        <p className="bg-surface rounded-card p-4 whitespace-pre-line">{content.notes}</p>
      )}
      {content.days.length === 0 && (
        <p className="text-muted">Dieser Plan enthält keine Trainingstage.</p>
      )}
      {content.days.map((day) => (
        <Card key={day.id}>
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                {day.name}
                <span className="text-muted text-sm font-normal">{weekdayLabel(day.weekday)}</span>
                <PlanTypeBadge type={day.type} />
              </span>
            }
          />
          <CardBody>
            <DayContent day={day} exercises={content.exercises} />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
