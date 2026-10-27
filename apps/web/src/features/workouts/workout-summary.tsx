import {
  shiftIsoWeek,
  type CompleteWorkoutResponse,
  type WeekPlanDay,
  type WeekView,
  type Weekday,
  type WorkoutLog,
  type WorkoutSet,
} from "@athletept/shared";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Pencil,
  Timer,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { WorkoutChallenges } from "@/features/challenges/workout-challenges";
import { formatPercent } from "@/features/stats/format";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

import { useMyWeek } from "./api";
import { dateOfWeekday, formatPerformedSets, formatWeekdayDate } from "./format";
import { NewRecords } from "./new-records";

/** Volumen (kg × Wdh.) der erledigten Sätze. */
function volumeOf(sets: readonly WorkoutSet[]) {
  return sets.reduce((sum, s) => sum + (s.done ? (s.weightKg ?? 0) * (s.reps ?? 0) : 0), 0);
}

/**
 * Volumen ohne ausgelassene Übungen und die Veränderung in Prozent gegenüber den zuletzt
 * geschafften Sätzen. Verglichen werden nur Übungen, die es schon einmal gab.
 */
function summarize(log: WorkoutLog) {
  let volume = 0;
  let compared = 0;
  let previous = 0;
  for (const exercise of log.exercises) {
    if (exercise.skipped) continue;
    const current = volumeOf(exercise.sets);
    volume += current;
    if (exercise.previous) {
      compared += current;
      previous += volumeOf(exercise.previous.sets);
    }
  }
  const end = Date.parse(log.completedAt ?? log.startedAt);
  const minutes = Math.max(0, Math.round((end - Date.parse(log.startedAt)) / 60_000));
  const change = previous > 0 ? Math.round((compared / previous - 1) * 100) : null;
  return { volume: Math.round(volume), change, minutes };
}

/** „52“ + „min“ bzw. „1:05“ + „h“, damit die Zahl groß und die Einheit klein stehen kann. */
function durationParts(minutes: number) {
  // Nur durchgeklickt: nicht „0 min“, das sähe nach einem Fehler aus.
  if (minutes < 1) return { value: "< 1", unit: "min" };
  if (minutes < 60) return { value: String(minutes), unit: "min" };
  return {
    value: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`,
    unit: "h",
  };
}

function formatMinutes(minutes: number) {
  const { value, unit } = durationParts(minutes);
  return `${value} ${unit}`;
}

interface StatTileProps {
  icon: typeof Timer;
  label: string;
  value: string;
  unit?: string;
  children?: ReactNode;
}

function StatTile({ icon: Icon, label, value, unit, children }: StatTileProps) {
  return (
    <div className="bg-surface flex flex-col gap-1 rounded-tile p-4">
      <dt className="text-muted flex items-center gap-1.5 text-sm">
        <Icon aria-hidden="true" className="size-4" /> {label}
      </dt>
      <dd className="flex flex-col gap-1">
        <span className="text-3xl font-semibold tabular-nums">
          {value}
          {unit && (
            <>
              {" "}
              <span className="text-muted text-base font-normal">{unit}</span>
            </>
          )}
        </span>
        {children}
      </dd>
    </div>
  );
}

function VolumeChange({ change }: { change: number }) {
  const Icon = change > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-sm font-medium",
        change > 0 ? "text-accent" : "text-muted",
      )}
    >
      {change !== 0 && <Icon aria-hidden="true" className="size-3.5" />}
      {formatPercent(change)} zum letzten Mal
    </span>
  );
}

/** Feste Tage nach Wochentag, danach die flexiblen. */
function sortDays(days: readonly WeekPlanDay[]) {
  return [...days].sort((a, b) => (a.weekday ?? 8) - (b.weekday ?? 8));
}

/** Nächstes offenes Training: diese Woche nach heute, dann flexibel, sonst nächste Woche. */
function findNext(week: WeekView, nextWeek: WeekView | undefined, logDayId: string) {
  const open = sortDays(week.days).filter((d) => d.status === "open" && d.dayId !== logDayId);
  const upcoming = open.find(
    (d) => d.weekday !== null && dateOfWeekday(week.startDate, d.weekday as Weekday) > week.today,
  );
  if (upcoming) {
    return {
      name: upcoming.name,
      date: dateOfWeekday(week.startDate, upcoming.weekday as Weekday),
    };
  }
  const flexible = open.find((d) => d.weekday === null);
  if (flexible) return { name: flexible.name, date: null };
  const first = nextWeek && sortDays(nextWeek.days).find((d) => d.weekday !== null);
  if (first && nextWeek) {
    return { name: first.name, date: dateOfWeekday(nextWeek.startDate, first.weekday as Weekday) };
  }
  return null;
}

const segmentStatus: Record<WeekPlanDay["status"], string> = {
  completed: "erledigt",
  skipped: "abgesagt",
  in_progress: "läuft",
  open: "offen",
};

function WeekProgress({ week, log }: { week: WeekView; log: WorkoutLog }) {
  const nextWeek = useMyWeek(shiftIsoWeek(week.week, 1));
  const next = findNext(week, nextWeek.data, log.dayId);
  const isToday = log.date === week.today;

  return (
    <section
      aria-labelledby="summary-week"
      className="bg-surface flex flex-col gap-3 rounded-tile p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="summary-week" className="font-semibold">
          Diese Woche
        </h2>
        <p className="text-muted text-sm">
          <span className="text-text font-semibold">{week.completedCount}</span> von{" "}
          {week.plannedCount} Einheiten
        </p>
      </div>
      <ol className="flex gap-1.5">
        {sortDays(week.days).map((day) => {
          const current = day.dayId === log.dayId;
          return (
            <li key={day.dayId} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 rounded-full",
                  current
                    ? "bg-accent"
                    : day.status === "completed"
                      ? "bg-primary"
                      : day.status === "skipped"
                        ? "bg-border"
                        : "bg-[repeating-linear-gradient(90deg,var(--border-strong)_0_3px,transparent_3px_6px)]",
                )}
              />
              <span
                className={cn(
                  "truncate text-xs",
                  current ? "text-text font-semibold" : "text-muted",
                )}
              >
                {current && isToday ? "Heute" : day.name}
                <span className="sr-only">
                  {current && isToday && ` (${day.name})`}: {segmentStatus[day.status]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {next && (
        <p className="border-border text-muted flex items-center gap-2 border-t pt-3 text-sm">
          <CalendarDays aria-hidden="true" className="text-accent size-4 shrink-0" />
          <span>
            Als Nächstes: <span className="text-text font-semibold">{next.name}</span>
            {next.date && ` · ${formatWeekdayDate(next.date)}`}
          </span>
        </p>
      )}
    </section>
  );
}

function ExerciseList({ log }: { log: WorkoutLog }) {
  return (
    <details className="group bg-surface rounded-tile">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          <span className="font-semibold">Übungen</span>
          <span className="text-muted"> · {log.exercises.length}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="text-muted size-5 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="flex flex-col gap-2 px-4 pb-4">
        {log.exercises.map((exercise) => {
          const done = exercise.sets.filter((s) => s.done);
          return (
            <li key={exercise.id} className="bg-inset rounded-card px-3 py-2.5">
              <p className="font-medium">{exercise.exerciseName}</p>
              <p className="text-muted text-sm">
                {exercise.skipped
                  ? "Ausgelassen"
                  : done.length > 0
                    ? formatPerformedSets(done)
                    : "Kein Satz erledigt"}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

interface WorkoutSummaryProps {
  log: CompleteWorkoutResponse;
  /** Öffnet das Protokoll zum Ansehen und Korrigieren. */
  onEdit?: () => void;
}

/** Abschluss-Bildschirm nach „Training abschließen“. */
export function WorkoutSummary({ log, onEdit }: WorkoutSummaryProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const week = useMyWeek();
  const { volume, change, minutes } = summarize(log);
  const duration = durationParts(minutes);
  const weekData = week.data;
  const showWeek =
    weekData !== undefined &&
    weekData.plannedCount > 0 &&
    log.date >= weekData.startDate &&
    log.date <= weekData.endDate;

  // Fokus auf die Überschrift: Screenreader erfahren vom Abschluss, die Seite scrollt nach oben.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 py-2">
      <title>Training abgeschlossen · AthletePT</title>
      <div className="mb-2 flex items-center gap-4">
        <span className="bg-primary text-on-primary flex size-14 shrink-0 items-center justify-center rounded-full">
          <Check aria-hidden="true" className="size-7" strokeWidth={2.6} />
        </span>
        <div className="min-w-0">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl leading-tight font-semibold outline-none"
          >
            Training abgeschlossen
          </h1>
          <p className="text-muted text-sm">
            {log.dayName} · {formatWeekdayDate(log.date)}
          </p>
        </div>
      </div>

      <NewRecords records={log.newRecords} exercises={log.exercises} />

      <dl className="grid grid-cols-2 gap-3">
        <StatTile icon={Timer} label="Dauer" value={duration.value} unit={duration.unit}>
          {log.averageDurationMinutes !== null && (
            <span className="text-muted text-sm">
              Ø {formatMinutes(log.averageDurationMinutes)}
            </span>
          )}
        </StatTile>
        <StatTile
          icon={Activity}
          label="Volumen"
          value={volume > 0 ? formatNumber(volume) : "–"}
          unit={volume > 0 ? "kg" : undefined}
        >
          {volume > 0 && change !== null && <VolumeChange change={change} />}
        </StatTile>
      </dl>

      <WorkoutChallenges updates={log.challenges} />

      {showWeek && <WeekProgress week={weekData} log={log} />}

      <ExerciseList log={log} />

      <div className="border-border mt-3 flex flex-col gap-2 border-t pt-5">
        <Button asChild size="lg">
          <Link to="/dashboard">Zur Übersicht</Link>
        </Button>
        {log.editable && onEdit && (
          <Button variant="ghost" onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" /> Training ansehen & korrigieren
          </Button>
        )}
      </div>
    </div>
  );
}
