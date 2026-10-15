import { WORKOUT_BACKFILL_DAYS, addDays, type PlanDay, type WeekView } from "@athletept/shared";
import { CalendarPlus, CalendarX, Play } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { ApiError, errorMessage } from "@/lib/http";

import { useSkipWorkout, useStartWorkout } from "./api";
import { formatLongDate } from "./format";
import { WorkoutStatusBadge } from "./workout-status-badge";

function DateField({
  value,
  today,
  onChange,
  error,
}: {
  value: string;
  today: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  return (
    <TextField
      label="Datum"
      type="date"
      required
      min={addDays(today, -WORKOUT_BACKFILL_DAYS)}
      max={today}
      value={value}
      error={error}
      hint={`Bis zu ${WORKOUT_BACKFILL_DAYS} Tage zurück.`}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Fehler zum Datum am Feld zeigen, alles andere als Toast. */
function dateError(error: unknown) {
  if (error instanceof ApiError) {
    const field = error.errors.find((e) => e.path === "date");
    if (field) return field.message;
  }
  toast(errorMessage(error), "error");
  return undefined;
}

/**
 * Training starten, nachtragen oder absagen. Läuft schon ein Training, geht es dorthin zurück.
 */
export function DayActions({ day, week }: { day: PlanDay; week: WeekView }) {
  const navigate = useNavigate();
  const start = useStartWorkout();
  const skip = useSkipWorkout();
  const [dialog, setDialog] = useState<"backfill" | "skip" | null>(null);
  const [date, setDate] = useState(week.today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const status = week.days.find((d) => d.dayId === day.id)?.status ?? "open";
  const running = week.inProgress;

  const open = (which: "backfill" | "skip") => {
    setDate(week.today);
    setReason("");
    setError(undefined);
    setDialog(which);
  };

  const startWorkout = async (on?: string) => {
    try {
      const log = await start.mutateAsync({ dayId: day.id, date: on });
      navigate(`/workouts/${log.id}`);
    } catch (e) {
      setError(dateError(e));
    }
  };

  const skipWorkout = async () => {
    try {
      await skip.mutateAsync({ dayId: day.id, date, notes: reason });
      toast(`${day.name} abgesagt.`);
      setDialog(null);
    } catch (e) {
      setError(dateError(e));
    }
  };

  if (running) {
    const here = running.dayId === day.id;
    return (
      <Alert variant="info" title={here ? "Training läuft" : `${running.dayName} läuft noch`}>
        <p>
          {here
            ? "Du hast dieses Training schon begonnen."
            : "Schließe es ab oder verwirf es, bevor du ein neues startest."}
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link to={`/workouts/${running.id}`}>
            <Play aria-hidden="true" className="size-4" /> Training fortsetzen
          </Link>
        </Button>
      </Alert>
    );
  }

  return (
    <section aria-label="Training" className="bg-surface flex flex-col gap-3 rounded-card p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        Diese Woche: <WorkoutStatusBadge status={status} />
      </p>
      <Button
        size="lg"
        loading={start.isPending && dialog === null}
        onClick={() => void startWorkout()}
      >
        <Play aria-hidden="true" className="size-5" />
        {status === "completed" ? "Nochmal trainieren" : "Training starten"}
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => open("backfill")}>
          <CalendarPlus aria-hidden="true" className="size-4" /> Nachtragen
        </Button>
        {status !== "completed" && status !== "skipped" && (
          <Button variant="secondary" className="flex-1" onClick={() => open("skip")}>
            <CalendarX aria-hidden="true" className="size-4" /> Absagen
          </Button>
        )}
      </div>

      <Dialog
        open={dialog === "backfill"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Training nachtragen"
        description={`${day.name} an einem früheren Tag eintragen.`}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void startWorkout(date);
          }}
        >
          <DateField value={date} today={week.today} onChange={setDate} error={error} />
          <Button type="submit" loading={start.isPending}>
            Eintragen
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "skip"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`${day.name} absagen?`}
        description="Dein Coach sieht die Absage und den Grund."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void skipWorkout();
          }}
        >
          <DateField value={date} today={week.today} onChange={setDate} error={error} />
          <TextareaField
            label="Grund (optional)"
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-muted text-sm">Für {formatLongDate(date || week.today)}.</p>
          <Button type="submit" loading={skip.isPending}>
            Training absagen
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
