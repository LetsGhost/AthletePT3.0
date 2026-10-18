import {
  activityWeekStatusLabels,
  addDays,
  isoWeekday,
  type ActivityDay,
  type ActivityResponse,
  type ActivityWeek,
} from "@athletept/shared";
import type { UseQueryResult } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Flame, Minus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { formatLongDate } from "@/features/workouts/format";
import { cn } from "@/lib/cn";

import { useAthleteActivity, useMyActivity } from "./api";
import { formatMinutes, formatMonth, shiftMonth } from "./format";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-inset flex flex-col rounded-card px-3 py-2">
      <span className="text-lg font-medium tabular-nums">{value}</span>
      <span className="text-muted text-sm">{label}</span>
    </div>
  );
}

/** Rechte Spalte: je Woche ein Häkchen, die laufende Woche zeigt die Streak. */
function WeekMarker({
  week,
  current,
  streak,
}: {
  week: ActivityWeek;
  current: boolean;
  streak: number;
}) {
  const label = `KW ${Number(week.week.slice(6))}: ${activityWeekStatusLabels[week.status]}${
    week.completedCount > 0
      ? ` (${week.completedCount} ${week.completedCount === 1 ? "Training" : "Trainings"})`
      : ""
  }`;
  const base = "mx-auto flex size-8 items-center justify-center rounded-full text-sm";
  if (current) {
    return (
      <span
        title={label}
        className={cn(base, "bg-module-streak font-semibold text-white dark:text-bg")}
      >
        <span aria-hidden="true">{streak}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      title={label}
      className={cn(
        base,
        week.status === "fulfilled" && "border-module-streak text-module-streak border-2",
        week.status === "missed" && "border-border-strong text-muted border-2",
        week.status === "paused" && "border-border-strong border-2 border-dashed",
        week.status === "upcoming" && "border-border border-2",
      )}
    >
      {week.status === "fulfilled" && <Check aria-hidden="true" className="size-4" />}
      {week.status === "missed" && <Minus aria-hidden="true" className="size-4" />}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function DayDetails({ day, logHref }: { day: ActivityDay; logHref: (logId: string) => string }) {
  return (
    <div aria-live="polite" className="bg-inset flex flex-col gap-2 rounded-card p-3">
      <p className="font-medium">{formatLongDate(day.date)}</p>
      <ul className="flex flex-col gap-1">
        {day.workouts.map((workout) => (
          <li key={workout.id}>
            <Link
              to={logHref(workout.id)}
              className="hover:text-accent flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2">
                <Flame aria-hidden="true" className="text-module-streak size-4" />
                {workout.dayName}
              </span>
              <span className="text-muted text-sm tabular-nums">
                {workout.durationMinutes === null
                  ? "Dauer unbekannt"
                  : formatMinutes(workout.durationMinutes)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CalendarProps {
  data: ActivityResponse;
  logHref: (logId: string) => string;
}

function ActivityCalendar({ data, logHref }: CalendarProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const byDate = new Map(data.days.map((day) => [day.date, day]));
  const selectedDay = selected ? byDate.get(selected) : undefined;
  const currentWeekStart = addDays(data.today, 1 - isoWeekday(data.today));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile
          value={`${data.streakWeeks} ${data.streakWeeks === 1 ? "Woche" : "Wochen"}`}
          label="Streak"
        />
        <Tile value={String(data.workoutCount)} label="Trainings" />
        <Tile
          value={formatMinutes(data.totalMinutes)}
          label={
            data.averageMinutes === null
              ? "Trainingszeit"
              : `Trainingszeit · Ø ${formatMinutes(data.averageMinutes)}`
          }
        />
      </div>

      <table className="w-full table-fixed border-separate border-spacing-y-1">
        <caption className="sr-only">
          Trainingskalender {formatMonth(data.month, data.today)}
        </caption>
        <thead>
          <tr className="text-muted text-xs">
            {WEEKDAYS.map((weekday) => (
              <th key={weekday} scope="col" className="font-normal">
                {weekday}
              </th>
            ))}
            <th scope="col" className="font-normal">
              <span className="sr-only">Woche</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.weeks.map((week, row) => (
            <tr key={week.week}>
              {WEEKDAYS.map((_, column) => {
                const date = addDays(week.startDate, column);
                if (!date.startsWith(data.month)) return <td key={date} />;
                const day = byDate.get(date);
                const isToday = date === data.today;
                const dayNumber = Number(date.slice(8));
                const circle = cn(
                  "mx-auto flex size-9 items-center justify-center rounded-full text-sm tabular-nums",
                  isToday && "ring-text ring-2",
                );
                return (
                  <td key={date} className="text-center">
                    {day ? (
                      <button
                        type="button"
                        aria-pressed={selected === date}
                        aria-label={`${formatLongDate(date)}: ${day.workouts.length} ${
                          day.workouts.length === 1 ? "Training" : "Trainings"
                        }`}
                        onClick={() => setSelected(selected === date ? null : date)}
                        className={cn(
                          circle,
                          "bg-module-streak/15 text-module-streak hover:bg-module-streak/25",
                          selected === date && "bg-module-streak text-white dark:text-bg",
                        )}
                      >
                        <Flame aria-hidden="true" className="size-5" />
                      </button>
                    ) : (
                      <span
                        className={cn(
                          circle,
                          "bg-inset text-muted",
                          date > data.today && "opacity-50",
                        )}
                      >
                        {dayNumber}
                      </span>
                    )}
                  </td>
                );
              })}
              <td
                className={cn(
                  "bg-module-streak/10 py-0.5",
                  row === 0 && "rounded-t-full pt-1.5",
                  row === data.weeks.length - 1 && "rounded-b-full pb-1.5",
                )}
              >
                <WeekMarker
                  week={week}
                  current={week.startDate === currentWeekStart}
                  streak={data.streakWeeks}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedDay ? (
        <DayDetails day={selectedDay} logHref={logHref} />
      ) : (
        <p className="text-muted text-sm">
          {data.workoutCount > 0
            ? "Tippe auf einen Tag mit Flamme, um das Training zu sehen."
            : "In diesem Monat noch kein abgeschlossenes Training."}
        </p>
      )}
    </div>
  );
}

interface StreakCardProps {
  query: UseQueryResult<ActivityResponse>;
  month: string | null;
  onMonthChange: (month: string | null) => void;
  logHref: (logId: string) => string;
}

/** Monatskalender mit Trainingstagen, Wochen-Streak und Trainingszeit. */
export function StreakCard({ query, month, onMonthChange, logHref }: StreakCardProps) {
  const data = query.data;
  const currentMonth = data?.today.slice(0, 7);
  const shown = month ?? currentMonth;

  const go = (months: number) => {
    if (!shown || !currentMonth) return;
    const next = shiftMonth(shown, months);
    onMonthChange(next === currentMonth ? null : next);
  };

  return (
    <Card>
      <CardHeader title="Streak" icon={Flame} iconClassName="text-module-streak" />
      <CardBody className="flex flex-col gap-3">
        {data && (
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xl font-semibold">{formatMonth(data.month, data.today)}</h3>
            <span className="flex">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Vorheriger Monat"
                disabled={query.isFetching}
                onClick={() => go(-1)}
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Nächster Monat"
                disabled={query.isFetching || shown === currentMonth}
                onClick={() => go(1)}
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </Button>
            </span>
          </div>
        )}
        <QueryState query={query} loading={<SkeletonList rows={5} className="h-10" />}>
          {(activity) => (
            <ActivityCalendar key={activity.month} data={activity} logHref={logHref} />
          )}
        </QueryState>
      </CardBody>
    </Card>
  );
}

export function MyStreakCard() {
  const [month, setMonth] = useState<string | null>(null);
  return (
    <StreakCard
      query={useMyActivity(month)}
      month={month}
      onMonthChange={setMonth}
      logHref={(logId) => `/workouts/${logId}`}
    />
  );
}

export function AthleteStreakCard({ athleteId }: { athleteId: string }) {
  const [month, setMonth] = useState<string | null>(null);
  return (
    <StreakCard
      query={useAthleteActivity(athleteId, month)}
      month={month}
      onMonthChange={setMonth}
      logHref={(logId) => `/coach/athletes/${athleteId}/workouts/${logId}`}
    />
  );
}
