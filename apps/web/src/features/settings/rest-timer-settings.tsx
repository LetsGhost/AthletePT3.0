import { ChevronDown, Hourglass, Timer, Vibrate, Volume2 } from "lucide-react";
import { useId, useState } from "react";

import { formatClock } from "@/features/workouts/format";
import {
  restDefaultOptions,
  setRestSettings,
  useRestSettings,
} from "@/features/workouts/rest-timer/rest-settings";
import { cn } from "@/lib/cn";

import { RowIcon, RowText, rowClasses, Switch } from "./settings-parts";

/** Pause mit Einheit, z. B. „45 s“ oder „1:30 min“. */
const pauseLabel = (seconds: number) =>
  seconds < 60 ? `${seconds} s` : `${formatClock(seconds)} min`;

/** Pausen-Timer im Training: an/aus, Standardpause, Ton und Vibration. */
export function RestTimerSettings() {
  const { enabled, defaultSeconds, sound, vibrate } = useRestSettings();
  const [pauseOpen, setPauseOpen] = useState(false);
  const id = useId();

  return (
    <>
      <div className={rowClasses}>
        <RowIcon icon={Timer} />
        <RowText id={`${id}-timer`} title="Pausen-Timer" sub="Startet nach jedem abgehakten Satz" />
        <Switch
          checked={enabled}
          onChange={(value) => setRestSettings({ enabled: value })}
          labelledBy={`${id}-timer`}
        />
      </div>
      {enabled && (
        <>
          <div>
            <button
              type="button"
              aria-expanded={pauseOpen}
              onClick={() => setPauseOpen(!pauseOpen)}
              className={cn(rowClasses, "hover:bg-inset/50")}
            >
              <RowIcon icon={Hourglass} />
              <RowText title="Standardpause" sub="Wenn der Coach nichts vorgibt" />
              <span className="text-accent text-sm font-semibold">
                {pauseLabel(defaultSeconds)}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn("text-muted size-4 transition-transform", pauseOpen && "rotate-180")}
              />
            </button>
            {pauseOpen && (
              <div
                role="radiogroup"
                aria-label="Standardpause"
                className="grid grid-cols-3 gap-1.5 px-3.5 pb-3.5 pl-15"
              >
                {restDefaultOptions.map((seconds) => (
                  <label
                    key={seconds}
                    className={cn(
                      "flex h-9 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium",
                      "has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2",
                      defaultSeconds === seconds
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-inset border-border hover:border-border-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="rest-default"
                      aria-label={pauseLabel(seconds)}
                      checked={defaultSeconds === seconds}
                      onChange={() => setRestSettings({ defaultSeconds: seconds })}
                      className="sr-only"
                    />
                    {pauseLabel(seconds).replace(" min", "")}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className={rowClasses}>
            <RowIcon icon={Volume2} />
            <RowText id={`${id}-sound`} title="Ton am Ende der Pause" />
            <Switch
              checked={sound}
              onChange={(value) => setRestSettings({ sound: value })}
              labelledBy={`${id}-sound`}
            />
          </div>
          <div className={rowClasses}>
            <RowIcon icon={Vibrate} />
            <RowText id={`${id}-vibrate`} title="Vibration" />
            <Switch
              checked={vibrate}
              onChange={(value) => setRestSettings({ vibrate: value })}
              labelledBy={`${id}-vibrate`}
            />
          </div>
        </>
      )}
    </>
  );
}
