import { weekdayLabels, weekdays } from "@athletept/shared";
import { CalendarDays, ClipboardCheck, Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast-store";
import { errorMessage } from "@/lib/http";

import { useAthleteWeek, useAthleteWorkouts, useUpdateWeeklyActivities } from "./api";
import { WeekNavigation, WeekOverview } from "./week-overview";
import { WorkoutList } from "./workout-list";

/** Wochenplan bearbeiten: vom Coach oder vom Athleten selbst (`athleteName` fehlt dann). */
export function WeeklyActivitiesDialog({
  athleteId,
  athleteName,
  activities,
  onOpenChange,
}: {
  athleteId: string;
  athleteName?: string;
  activities: (string | null)[];
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateWeeklyActivities(athleteId);
  const [values, setValues] = useState(() => activities.map((a) => a ?? ""));

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title="Wochenplan bearbeiten"
      description={`Was ${athleteName ? `macht ${athleteName}` : "machst du"} außer dem Krafttraining, z. B. Laufen oder Fußball? Gilt jede Woche, unabhängig vom Trainingsplan.`}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          update
            .mutateAsync({ activities: values })
            .then(() => {
              toast("Wochenplan gespeichert.");
              onOpenChange(false);
            })
            .catch((error: unknown) => toast(errorMessage(error), "error"));
        }}
      >
        {weekdays.map((weekday, i) => (
          <TextField
            key={weekday}
            label={weekdayLabels[weekday]}
            maxLength={40}
            value={values[i]}
            placeholder="frei"
            onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
        <Button type="submit" className="mt-2" loading={update.isPending}>
          Speichern
        </Button>
      </form>
    </Dialog>
  );
}

/** Trainingswoche eines Athleten für den Coach, mit Wochenplan. */
export function AthleteWeekCard({
  athleteId,
  athleteName,
}: {
  athleteId: string;
  athleteName: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const week = useAthleteWeek(athleteId, selected);

  return (
    <Card>
      <CardHeader
        title="Trainingswoche"
        icon={CalendarDays}
        iconClassName="text-module-week"
        action={
          week.data && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" className="size-4" /> Wochenplan
            </Button>
          )
        }
      />
      <CardBody>
        <QueryState query={week} loading={<SkeletonList rows={4} className="h-12" />}>
          {(data) => (
            <div className="flex flex-col gap-4">
              <WeekNavigation
                week={data}
                selected={selected}
                onChange={setSelected}
                loading={week.isFetching}
              />
              <WeekOverview
                week={data}
                dayHref={(day) => {
                  const log = day.logs.find((l) => l.status !== "in_progress");
                  return log ? `/coach/athletes/${athleteId}/workouts/${log.id}` : null;
                }}
                logHref={(log) => `/coach/athletes/${athleteId}/workouts/${log.id}`}
              />
              {editing && (
                <WeeklyActivitiesDialog
                  athleteId={athleteId}
                  athleteName={athleteName}
                  activities={data.activities}
                  onOpenChange={setEditing}
                />
              )}
            </div>
          )}
        </QueryState>
      </CardBody>
    </Card>
  );
}

/** Abgeschlossene und abgesagte Trainings eines Athleten. */
export function AthleteWorkoutsCard({
  athleteId,
  athleteName,
}: {
  athleteId: string;
  athleteName: string;
}) {
  const [page, setPage] = useState(1);
  const workouts = useAthleteWorkouts(athleteId, page);

  return (
    <Card>
      <CardHeader
        title="Trainingsprotokolle"
        icon={ClipboardCheck}
        iconClassName="text-module-hints"
      />
      <CardBody>
        <QueryState query={workouts} loading={<SkeletonList rows={3} className="h-16" />}>
          {(data) =>
            data.total === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="Noch keine Trainings"
                description={`Sobald ${athleteName} ein Training abschließt oder absagt, erscheint es hier.`}
              />
            ) : (
              <WorkoutList
                data={data}
                label={`Trainings von ${athleteName}`}
                href={(log) => `/coach/athletes/${athleteId}/workouts/${log.id}`}
                page={page}
                onPageChange={setPage}
                loading={workouts.isFetching}
              />
            )
          }
        </QueryState>
      </CardBody>
    </Card>
  );
}
