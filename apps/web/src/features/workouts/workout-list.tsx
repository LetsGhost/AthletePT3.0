import type { WorkoutLogListResponse, WorkoutLogSummary } from "@athletept/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { WORKOUT_PAGE_SIZE } from "./api";
import { formatWeekdayDate } from "./format";
import { WorkoutStatusBadge } from "./workout-status-badge";

function summaryText(log: WorkoutLogSummary) {
  if (log.status === "skipped") return log.notes ?? "Ohne Begründung";
  const parts = [`${log.doneSetCount} ${log.doneSetCount === 1 ? "Satz" : "Sätze"}`];
  if (log.rating !== null) parts.push(`Bewertung ${log.rating}/10`);
  return parts.join(" · ");
}

interface WorkoutListProps {
  data: WorkoutLogListResponse;
  label: string;
  href: (log: WorkoutLogSummary) => string;
  page: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  /** Wo die Blätter-Navigation sitzt; Standard ist unter der Liste. */
  paginationPosition?: "top" | "bottom";
}

/** Trainings, neueste zuerst, mit Blättern. */
export function WorkoutList({
  data,
  label,
  href,
  page,
  onPageChange,
  loading,
  paginationPosition = "bottom",
}: WorkoutListProps) {
  const pages = Math.max(1, Math.ceil(data.total / WORKOUT_PAGE_SIZE));
  const pagination = pages > 1 && (
    <nav aria-label="Seiten" className="flex items-center justify-between gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Neuere
      </Button>
      <span className="text-muted text-sm">
        Seite {page} von {pages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        Ältere <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </nav>
  );
  return (
    <div className="flex flex-col gap-3" aria-busy={loading || undefined}>
      {paginationPosition === "top" && pagination}
      <ul className="flex flex-col gap-2" aria-label={label}>
        {data.items.map((log) => (
          <li key={log.id}>
            <Link
              to={href(log)}
              className="bg-inset hover:border-border-strong flex items-center gap-3 rounded-card border border-transparent p-3 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{log.dayName}</span>
                  <WorkoutStatusBadge status={log.status} />
                </span>
                <span className="text-muted block text-sm">
                  {formatWeekdayDate(log.date)} · {summaryText(log)}
                </span>
                {log.status !== "skipped" && log.notes && (
                  <span className="mt-1 line-clamp-2 block text-sm">„{log.notes}“</span>
                )}
              </span>
              <ChevronRight aria-hidden="true" className="text-muted size-5 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      {paginationPosition === "bottom" && pagination}
    </div>
  );
}
