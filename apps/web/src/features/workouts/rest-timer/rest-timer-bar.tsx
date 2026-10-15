import { SkipForward, X } from "lucide-react";

import { cn } from "@/lib/cn";

import { formatClock } from "../format";
import type { RestTimerControls } from "./use-rest-timer";

const controlClasses =
  "flex h-11 min-w-12 items-center justify-center rounded-card text-sm font-medium tabular-nums";

/** Schwebt über der Tab-Leiste, solange eine Pause läuft, und meldet kurz deren Ende. */
export function RestTimerBar({ rest }: { rest: RestTimerControls }) {
  const { timer, remaining, finished, adjust, stop } = rest;
  if (!timer) return null;
  const percent = finished ? 0 : (remaining / timer.total) * 100;

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 rounded-card p-3 pl-4 shadow-lg",
        "lg:inset-x-auto lg:right-8 lg:bottom-6 lg:w-96",
        "bg-primary text-on-primary",
      )}
    >
      {/* Nur Start und Ende ansagen, nicht jede Sekunde. */}
      <p role="status" className="sr-only">
        {finished ? "Pause vorbei" : "Pause läuft"}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs opacity-80">Pause · {timer.exerciseName}</span>
          <span role="timer" className="text-2xl leading-tight font-semibold tabular-nums">
            {finished ? "Pause vorbei" : formatClock(remaining)}
          </span>
        </div>
        {finished ? (
          <button
            type="button"
            aria-label="Hinweis schließen"
            className={cn(controlClasses, "bg-on-primary text-primary w-11 min-w-0")}
            onClick={stop}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        ) : (
          <>
            <button
              type="button"
              aria-label="15 Sekunden weniger"
              className={cn(controlClasses, "border-on-primary/40 border")}
              onClick={() => adjust(-15)}
            >
              −15
            </button>
            <button
              type="button"
              aria-label="15 Sekunden mehr"
              className={cn(controlClasses, "border-on-primary/40 border")}
              onClick={() => adjust(15)}
            >
              +15
            </button>
            <button
              type="button"
              aria-label="Pause überspringen"
              className={cn(controlClasses, "bg-on-primary text-primary w-11 min-w-0")}
              onClick={stop}
            >
              <SkipForward aria-hidden="true" className="size-5" />
            </button>
          </>
        )}
      </div>
      <div aria-hidden="true" className="bg-on-primary/20 h-1 overflow-hidden rounded-full">
        <div
          className="bg-on-primary h-full rounded-full transition-[width] duration-300 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
