import {
  isoWeekOf,
  shiftIsoWeek,
  weekdays,
  type WeekPlanDay,
  type WeekView,
  type WorkoutLogSummary,
} from "@athletept/shared";
import { CalendarDays, ChevronLeft, ChevronRight, Footprints } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlanTypeBadge } from "@/features/plans/plan-type-badge";
import { cn } from "@/lib/cn";

import { dateOfWeekday, formatWeek, formatWeekdayDate } from "./format";
import { WorkoutStatusBadge } from "./workout-status-badge";

interface WeekOverviewProps {
  week: WeekView;
  /** Ziel beim Klick auf einen Plantag, `null` für keinen Link. */
  dayHref: (day: WeekPlanDay) => string | null;
  logHref: (log: WorkoutLogSummary) => string | null;
}

function DayItem({ day, href }: { day: WeekPlanDay; href: string | null }) {
  const content = (
    <>
      <span className="min-w-0 flex-1 font-medium">{day.name}</span>
      <span className="flex flex-wrap items-center justify-end gap-1.5">
        <PlanTypeBadge type={day.type} className="hidden sm:inline-flex" />
        <WorkoutStatusBadge status={day.status} />
      </span>
    </>
  );
  const classes = "bg-inset flex min-h-11 items-center gap-2 rounded-card px-3 py-2";
  return (
    <li>
      {href ? (
        <Link
          to={href}
          className={cn(classes, "hover:border-border-strong border border-transparent")}
        >
          {content}
          <ChevronRight aria-hidden="true" className="text-muted size-4 shrink-0" />
        </Link>
      ) : (
        <div className={classes}>{content}</div>
      )}
    </li>
  );
}

/**
 * Woche von Montag bis Sonntag mit Plantagen, Status und Wochenplan (Freitexte), danach flexible
 * Tage und Protokolle aus einem früheren Plan.
 */
export function WeekOverview({ week, dayHref, logHref }: WeekOverviewProps) {
  const flexible = week.days.filter((d) => d.weekday === null);

  return (
    <div className="flex flex-col gap-4">
      {week.plannedCount > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm">
            <span className="font-medium">
              {week.completedCount} von {week.plannedCount}
            </span>{" "}
            Trainings erledigt
          </p>
          <Progress
            value={week.completedCount}
            max={week.plannedCount}
            label="Erledigte Trainings dieser Woche"
          />
        </div>
      )}

      <ol className="flex flex-col gap-2" aria-label="Wochentage">
        {weekdays.map((weekday) => {
          const date = dateOfWeekday(week.startDate, weekday);
          const days = week.days.filter((d) => d.weekday === weekday);
          const activity = week.activities[weekday - 1];
          const isToday = date === week.today;
          return (
            <li
              key={weekday}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "flex flex-col gap-1.5 rounded-card border p-2 sm:flex-row sm:items-start sm:gap-3",
                isToday ? "border-accent" : "border-transparent",
              )}
            >
              <span className="text-muted shrink-0 pt-2 text-sm sm:w-36">
                {formatWeekdayDate(date)}
                {isToday && (
                  <span className="text-text font-medium whitespace-nowrap"> · heute</span>
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {days.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {days.map((day) => (
                      <DayItem key={day.dayId} day={day} href={dayHref(day)} />
                    ))}
                  </ul>
                )}
                {activity && (
                  <p className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Footprints aria-hidden="true" className="text-muted size-4 shrink-0" />
                    {activity}
                  </p>
                )}
                {days.length === 0 && !activity && (
                  <p className="text-muted px-3 py-2 text-sm">Frei</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {flexible.length > 0 && (
        <section aria-labelledby="week-flexible" className="flex flex-col gap-2">
          <h3 id="week-flexible" className="text-sm font-medium">
            Ohne festen Tag
          </h3>
          <ul className="flex flex-col gap-1.5">
            {flexible.map((day) => (
              <DayItem key={day.dayId} day={day} href={dayHref(day)} />
            ))}
          </ul>
        </section>
      )}

      {week.otherLogs.length > 0 && (
        <section aria-labelledby="week-other" className="flex flex-col gap-2">
          <h3 id="week-other" className="text-sm font-medium">
            Aus einem früheren Plan
          </h3>
          <ul className="flex flex-col gap-1.5">
            {week.otherLogs.map((log) => {
              const href = logHref(log);
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{log.dayName}</span>
                    <span className="text-muted block text-sm">{formatWeekdayDate(log.date)}</span>
                  </span>
                  <WorkoutStatusBadge status={log.status} />
                </>
              );
              const classes = "bg-inset flex min-h-11 items-center gap-2 rounded-card px-3 py-2";
              return (
                <li key={log.id}>
                  {href ? (
                    <Link to={href} className={classes}>
                      {content}
                    </Link>
                  ) : (
                    <div className={classes}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

interface WeekNavigationProps {
  week: WeekView;
  /** Aktuell gewählte Woche, `null` = diese Woche. */
  selected: string | null;
  onChange: (week: string | null) => void;
  loading?: boolean;
}

/** Vor- und Zurückblättern zwischen Wochen. */
export function WeekNavigation({ week, selected, onChange, loading }: WeekNavigationProps) {
  const go = (weeks: number) => {
    const target = shiftIsoWeek(week.week, weeks);
    onChange(target === isoWeekOf(week.today) ? null : target);
  };
  return (
    <div className="flex items-center gap-1" aria-busy={loading || undefined}>
      <Button variant="ghost" size="icon" aria-label="Vorherige Woche" onClick={() => go(-1)}>
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Button>
      <p className="min-w-0 flex-1 text-center text-sm font-medium" aria-live="polite">
        <CalendarDays aria-hidden="true" className="text-muted mr-1.5 inline size-4 align-[-2px]" />
        {formatWeek(week.week, week.startDate)}
      </p>
      <Button variant="ghost" size="icon" aria-label="Nächste Woche" onClick={() => go(1)}>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Button>
      {selected !== null && (
        <Button variant="secondary" size="sm" onClick={() => onChange(null)}>
          Heute
        </Button>
      )}
    </div>
  );
}
