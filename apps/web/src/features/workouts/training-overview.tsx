import {
  planTypeLabels,
  weekdayLabels,
  weekdays,
  type PlanDay,
  type WeekView,
  type WorkoutLogSummary,
} from "@athletept/shared";
import { Check, ChevronDown, Info, Play, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { weekdayLabel } from "@/features/plans/format";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/http";

import { useSkipWorkout, useStartWorkout } from "./api";
import { dateOfWeekday, formatDayMonth } from "./format";
import {
  dayImages,
  estimateMinutes,
  exerciseScheme,
  statusOf,
  workingSetCount,
  type NextTraining,
} from "./next-training";

/** Training heute starten und zum Protokoll wechseln. */
function useStartDay() {
  const navigate = useNavigate();
  const start = useStartWorkout();
  const startDay = async (day: PlanDay) => {
    try {
      const log = await start.mutateAsync({ dayId: day.id });
      navigate(`/workouts/${log.id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };
  return { startDay, pendingId: start.isPending ? start.variables.dayId : null };
}

function DayImage({ day, className }: { day: PlanDay; className?: string }) {
  return (
    <span
      className={cn(
        "bg-inset flex shrink-0 items-center justify-center overflow-hidden rounded-[14px]",
        className,
      )}
    >
      <img
        src={dayImages[day.type]}
        alt=""
        aria-hidden="true"
        className="max-h-[86%] max-w-[86%]"
      />
    </span>
  );
}

function ExerciseList({ day, compact }: { day: PlanDay; compact?: boolean }) {
  return (
    <ol className="flex flex-col" aria-label={`Übungen ${day.name}`}>
      {day.exercises.map((entry, index) => (
        <li
          key={entry.id}
          className={cn(
            "flex items-center gap-2.5",
            compact ? "py-1.5" : "border-border border-t py-2.5",
          )}
        >
          <span
            aria-hidden="true"
            className="bg-inset text-muted flex size-5.5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{entry.exerciseName}</span>
          <span className="text-muted shrink-0 text-xs">{exerciseScheme(entry)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Kurz absagen: Datum ist heute, Grund optional. */
function QuickSkipDialog({ day, onClose }: { day: PlanDay | null; onClose: () => void }) {
  const skip = useSkipWorkout();
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!day) return;
    try {
      await skip.mutateAsync({ dayId: day.id, notes: reason });
      toast(`${day.name} abgesagt.`);
      setReason("");
      onClose();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <Dialog
      open={day !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`${day?.name ?? "Training"} absagen?`}
      description="Für heute. Dein Coach sieht die Absage und den Grund."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextareaField
          label="Grund (optional)"
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button type="submit" loading={skip.isPending}>
          Training absagen
        </Button>
      </form>
    </Dialog>
  );
}

const heroChip: Record<NextTraining["kind"], string> = {
  running: "Läuft gerade",
  planned: "Als Nächstes",
  overdue: "Noch offen",
  nextWeek: "Woche geschafft",
};

function heroDate(next: NextTraining, today: string) {
  if (next.kind === "running") return "Schon begonnen";
  if (next.date === null) return "Flexibel, wann es dir passt";
  if (next.date === today) return `Heute, ${formatDayMonth(next.date)}`;
  if (next.kind === "overdue") return `Geplant für ${formatDayMonth(next.date)}`;
  if (next.kind === "nextWeek") return `Weiter am ${formatDayMonth(next.date)}`;
  return formatDayMonth(next.date);
}

/** Großes Kärtchen mit dem nächsten Training: Eckdaten, Übungen, Start und Absage. */
export function NextTrainingCard({ next, week }: { next: NextTraining; week: WeekView }) {
  const { startDay, pendingId } = useStartDay();
  const [skipping, setSkipping] = useState<PlanDay | null>(null);
  const { day, kind } = next;
  const stats = [
    { value: day.exercises.length, label: day.exercises.length === 1 ? "Übung" : "Übungen" },
    { value: workingSetCount(day), label: "Sätze" },
    { value: `~${estimateMinutes(day)} min`, label: "Dauer" },
  ];

  return (
    <section
      aria-labelledby="next-training"
      className="bg-surface border-accent/40 overflow-hidden rounded-tile border"
    >
      <div className="flex items-center gap-3.5 px-4 pt-4 pb-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="bg-accent/12 text-accent inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
            <span aria-hidden="true" className="bg-accent size-1.5 rounded-full" />
            {heroChip[kind]}
          </span>
          <h2 id="next-training" className="text-2xl leading-tight font-semibold tracking-tight">
            {day.name}
          </h2>
          <span className="text-muted text-sm">{heroDate(next, week.today)}</span>
        </div>
        <DayImage day={day} className="size-21 rounded-[18px]" />
      </div>

      <dl className="border-border grid grid-cols-3 border-y">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              "flex flex-col-reverse items-center gap-px py-2.5",
              i === 1 && "border-border border-x",
            )}
          >
            <dt className="text-muted text-[11px]">{stat.label}</dt>
            <dd className="font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="px-4 pt-2.5 pb-1">
        <ExerciseList day={day} compact />
      </div>

      <div className="flex flex-col gap-1 px-4 pt-2.5 pb-4">
        {kind === "running" ? (
          <Button asChild size="lg" className="w-full">
            <Link to={`/workouts/${week.inProgress!.id}`}>
              <Play aria-hidden="true" className="size-4 fill-current" /> Training fortsetzen
            </Link>
          </Button>
        ) : (
          <Button
            size="lg"
            variant={kind === "nextWeek" ? "secondary" : "primary"}
            className="w-full"
            loading={pendingId === day.id}
            onClick={() => void startDay(day)}
          >
            <Play aria-hidden="true" className="size-4 fill-current" />
            {kind === "nextWeek" ? "Trotzdem trainieren" : "Training starten"}
          </Button>
        )}
        {(kind === "planned" || kind === "overdue") && (
          <Button variant="ghost" size="sm" className="text-muted" onClick={() => setSkipping(day)}>
            Heute nicht? Training absagen
          </Button>
        )}
      </div>
      <QuickSkipDialog day={skipping} onClose={() => setSkipping(null)} />
    </section>
  );
}

type StripState = "completed" | "skipped" | "running" | "next" | "planned" | "free";

const stripLabels: Record<StripState, string> = {
  completed: "erledigt",
  skipped: "abgesagt",
  running: "läuft",
  next: "als Nächstes",
  planned: "geplant",
  free: "frei",
};

const stripShort = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Mo–So als Punkte: erledigt, abgesagt, als Nächstes, geplant oder frei. */
export function WeekStrip({
  days,
  week,
  next,
}: {
  days: readonly PlanDay[];
  week: WeekView;
  next: NextTraining | null;
}) {
  const logs: WorkoutLogSummary[] = [...week.days.flatMap((d) => d.logs), ...week.otherLogs];
  const nextDate =
    next && next.kind === "planned" && next.date !== null && next.date >= week.today
      ? next.date
      : null;

  const stateOf = (date: string, weekday: number): StripState => {
    const onDate = logs.filter((l) => l.date === date);
    if (onDate.some((l) => l.status === "completed")) return "completed";
    if (onDate.some((l) => l.status === "in_progress")) return "running";
    if (onDate.some((l) => l.status === "skipped")) return "skipped";
    if (date === nextDate) return "next";
    if (days.some((d) => d.weekday === weekday) && date > week.today) return "planned";
    return "free";
  };

  return (
    <section
      aria-labelledby="week-strip"
      className="bg-surface flex flex-col gap-3 rounded-tile p-3.5"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="week-strip" className="text-sm font-semibold">
          Diese Woche
        </h2>
        {week.plannedCount > 0 && (
          <span className="text-muted text-sm">
            <b className="text-text font-semibold">{week.completedCount}</b> von {week.plannedCount}{" "}
            erledigt
          </span>
        )}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {weekdays.map((weekday) => {
          const date = dateOfWeekday(week.startDate, weekday);
          const state = stateOf(date, weekday);
          const isToday = date === week.today;
          return (
            <li
              key={weekday}
              aria-current={isToday ? "date" : undefined}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "text-[11px]",
                  isToday
                    ? "text-accent font-semibold"
                    : state === "free"
                      ? "text-muted"
                      : "text-text font-medium",
                )}
              >
                {stripShort[weekday - 1]}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8.5 items-center justify-center rounded-full",
                  state === "completed" && "bg-primary text-on-primary",
                  state === "running" && "bg-primary/40 text-on-primary",
                  state === "skipped" && "bg-inset text-muted",
                  state === "next" && "border-accent bg-accent/8 border-2",
                  state === "planned" && "border-border-strong border border-dashed",
                  state === "free" && "bg-inset",
                )}
              >
                {state === "completed" && <Check className="size-4" strokeWidth={3} />}
                {state === "skipped" && <X className="size-4" strokeWidth={2.5} />}
                {(state === "next" || state === "running") && (
                  <span className="bg-accent size-2 rounded-full" />
                )}
              </span>
              <span className="sr-only">
                {weekdayLabels[weekday]}
                {isToday ? " (heute)" : ""}: {stripLabels[state]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const statusLabels = {
  next: "Als Nächstes",
  open: "Offen",
  in_progress: "Läuft",
  completed: "Erledigt",
  skipped: "Abgesagt",
} as const;

/** Trainingstag zum Aufklappen: Übungen, Start, Absage und Link zu den Details. */
export function TrainingDayCard({
  day,
  week,
  isNext,
}: {
  day: PlanDay;
  week: WeekView;
  isNext: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [skipping, setSkipping] = useState<PlanDay | null>(null);
  const { startDay, pendingId } = useStartDay();
  const status = statusOf(week, day.id);
  const badge = isNext && status === "open" ? "next" : status;
  const running = week.inProgress;
  const done = status === "completed" || status === "skipped";
  const panelId = `day-panel-${day.id}`;
  const meta = [
    `${day.exercises.length} ${day.exercises.length === 1 ? "Übung" : "Übungen"}`,
    `ca. ${estimateMinutes(day)} min`,
    planTypeLabels[day.type],
  ].join(" · ");

  return (
    <article
      className={cn(
        "bg-surface overflow-hidden rounded-tile border",
        badge === "next" ? "border-accent/40" : "border-transparent",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 py-3 pr-3.5 pl-3 text-left"
      >
        <DayImage day={day} className="size-14" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-muted text-xs">{weekdayLabel(day.weekday)}</span>
          <span className="truncate font-semibold">{day.name}</span>
          <span className="text-muted text-xs">{meta}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
              badge === "next" || badge === "in_progress"
                ? "bg-accent/14 text-accent"
                : "bg-inset text-muted",
            )}
          >
            {statusLabels[badge]}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("text-muted size-4.5 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-2.5 px-3.5 pb-3.5">
          <ExerciseList day={day} />
          {running ? (
            running.dayId === day.id ? (
              <Button asChild className="w-full">
                <Link to={`/workouts/${running.id}`}>
                  <Play aria-hidden="true" className="size-4 fill-current" /> Training fortsetzen
                </Link>
              </Button>
            ) : (
              <p className="text-muted text-sm">
                {running.dayName} läuft noch. Schließe es ab, bevor du ein neues startest.
              </p>
            )
          ) : (
            <Button
              variant={done ? "secondary" : "primary"}
              className="w-full"
              loading={pendingId === day.id}
              onClick={() => void startDay(day)}
            >
              <Play aria-hidden="true" className="size-4 fill-current" />
              {status === "completed" ? "Nochmal trainieren" : "Training starten"}
            </Button>
          )}
          <div className="flex gap-2">
            {!running && !done && (
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setSkipping(day)}>
                <X aria-hidden="true" className="size-4" /> Absagen
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="flex-1">
              <Link to={`/plan/${day.id}`} aria-label={`Details zu ${day.name}`}>
                <Info aria-hidden="true" className="size-4" /> Details
              </Link>
            </Button>
          </div>
        </div>
      )}
      <QuickSkipDialog day={skipping} onClose={() => setSkipping(null)} />
    </article>
  );
}
