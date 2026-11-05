import {
  recordKindLabels,
  type ExerciseStatsDetail,
  type RecordKind,
  type StatsMetric,
} from "@athletept/shared";
import { ChevronRight, Info } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/features/settings/settings-parts";
import { DeviatingBadge } from "@/features/workouts/deviating-badge";
import { formatWeekdayDate } from "@/features/workouts/format";
import { cn } from "@/lib/cn";

import { ChangeBadge } from "./change";
import {
  chartKinds,
  chartLabels,
  formatBestSet,
  formatChartValue,
  formatRecordValue,
  formatShortDate,
  mainCurrent,
  metricLabels,
  type ChartKind,
} from "./format";
import { ProgressChart } from "./progress-chart";

const tileKinds: Record<StatsMetric, RecordKind[]> = {
  estimated1rm: ["estimated1rm", "topWeightKg", "maxReps"],
  topWeightKg: ["topWeightKg", "maxReps"],
  maxReps: ["maxReps"],
  maxDurationSeconds: ["maxDurationSeconds"],
};

/** Kurzlabel unter dem Wert einer Einheit, wenn die Einheit allein nicht reicht. */
const rowLabels: Partial<Record<StatsMetric, string>> = {
  estimated1rm: "gesch. Max.",
  topWeightKg: "höchstes",
};

interface ExerciseProgressProps {
  data: ExerciseStatsDetail;
  logHref: (logId: string) => string;
  /** Abweichende Trainings (anderes Gerät/Gym) nicht in Diagramm, Bestwerten und Verlauf. */
  hideDeviating: boolean;
  onHideDeviatingChange: (hide: boolean) => void;
}

/** Aktueller Stand, Bestwerte, Verlauf als Diagramm und die einzelnen Einheiten. */
export function ExerciseProgress({
  data,
  logHref,
  hideDeviating,
  onHideDeviatingChange,
}: ExerciseProgressProps) {
  const [kind, setKind] = useState<ChartKind>(data.metric);
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const estimated = data.metric === "estimated1rm";
  const change = data.change;
  const hasDeviating = data.sessions.some((s) => s.deviating);
  // Stabil halten, sonst baut das Diagramm bei jedem Rendern neu auf.
  const visible = useMemo(
    () => (hideDeviating ? data.sessions.filter((s) => !s.deviating) : data.sessions),
    [data.sessions, hideDeviating],
  );
  const kinds = chartKinds[data.metric];
  const chartLabel = `Diagramm ${chartLabels[kind]}: ${visible
    .filter((s) => s[kind] !== null)
    .map((s) => `${formatShortDate(s.date)} ${formatChartValue(kind, s[kind]!)}`)
    .join(", ")}`;

  return (
    <div className="flex flex-col gap-3.5">
      <section
        aria-label="Aktueller Stand"
        className="bg-surface flex flex-col gap-1.5 rounded-tile p-4"
      >
        <span className="text-muted flex items-center gap-1.5 text-sm">
          {metricLabels[data.metric]}
          {estimated && (
            <button
              type="button"
              aria-expanded={info}
              aria-controls={infoId}
              aria-label="Wie wird das berechnet?"
              onClick={() => setInfo(!info)}
              className="hover:text-text -my-2 inline-flex size-8 items-center justify-center rounded-lg"
            >
              <Info aria-hidden="true" className="size-4" />
            </button>
          )}
        </span>
        <span className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-4xl leading-tight font-bold tabular-nums">{mainCurrent(data)}</span>
          {/* Das „seit …“ steht sichtbar darunter, deshalb hier nicht noch einmal vorlesen. */}
          <ChangeBadge summary={data} hideSince />
        </span>
        {change && (
          <span className="text-muted text-xs">
            seit {formatWeekdayDate(change.fromDate)} ({formatRecordValue(data.metric, change.from)}
            ){hasDeviating && " · ohne abweichende"}
          </span>
        )}
        {estimated && (
          <p
            id={infoId}
            hidden={!info}
            className="bg-inset mt-1.5 rounded-card px-3 py-2.5 text-xs leading-relaxed"
          >
            Geschätzt aus Gewicht und Wiederholungen des besten Satzes (Epley-Formel, nur Sätze bis
            12 Wdh.). So lassen sich Einheiten mit unterschiedlichen Wiederholungen vergleichen.
          </p>
        )}
      </section>

      <section aria-labelledby="best-values" className="flex flex-col gap-2">
        <h2 id="best-values" className="px-0.5 font-semibold">
          Bestwerte
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {tileKinds[data.metric].map((recordKind) => {
            const record = data.best[recordKind];
            return (
              <div
                key={recordKind}
                className="bg-surface flex flex-col gap-0.5 rounded-tile px-3.5 py-3 last:odd:col-span-2"
              >
                <span className="text-muted text-xs">{recordKindLabels[recordKind]}</span>
                <span className="text-xl font-semibold tabular-nums">
                  {record ? formatRecordValue(recordKind, record.value) : "–"}
                </span>
                {record && (
                  <span className="text-muted flex flex-wrap items-center gap-1.5 text-xs">
                    am {formatWeekdayDate(record.date)}
                    {record.deviating && <DeviatingBadge />}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Verlauf" className="bg-surface flex flex-col gap-3 rounded-tile p-3.5">
        {kinds.length > 1 && (
          <SegmentedControl
            label="Kennzahl"
            options={kinds.map((k) => ({ value: k, label: chartLabels[k] }))}
            value={kind}
            onChange={setKind}
            className="bg-inset [&>button]:flex-1 [&>button]:px-1 [&>button]:text-xs"
          />
        )}
        {visible.length === 0 ? (
          <div className="bg-inset flex flex-col items-center gap-2 rounded-card p-6 text-center">
            <p className="text-sm">Alle Trainings sind als abweichend markiert</p>
            <Button variant="secondary" size="sm" onClick={() => onHideDeviatingChange(false)}>
              Einblenden
            </Button>
          </div>
        ) : visible.length > 1 ? (
          <ProgressChart sessions={visible} kind={kind} label={chartLabel} />
        ) : (
          <p className="text-muted py-4 text-center text-sm">
            Ab zwei Einheiten erscheint hier der Verlauf.
          </p>
        )}
        {hasDeviating && (
          <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-2.5">
            <span aria-hidden="true" className="text-muted flex items-center gap-1.5 text-xs">
              <span className="bg-accent size-2.5 rounded-full" /> normal
            </span>
            <span aria-hidden="true" className="text-muted flex items-center gap-1.5 text-xs">
              <span className="border-accent size-2.5 rotate-45 border-2" /> abweichend
            </span>
            <span className="flex-1" />
            <span id="hide-deviating" className="text-muted text-xs">
              Abweichende ausblenden
            </span>
            <Switch
              checked={hideDeviating}
              labelledBy="hide-deviating"
              onChange={onHideDeviatingChange}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="sessions" className="flex flex-col gap-2">
        <h2 id="sessions" className="px-0.5 font-semibold">
          Einheiten
        </h2>
        <ul className="bg-surface divide-border divide-y overflow-hidden rounded-tile">
          {[...data.sessions].reverse().map((session) => {
            const main = session[data.metric];
            const bestSet = formatBestSet(session);
            return (
              <li key={session.logId}>
                <Link
                  to={logHref(session.logId)}
                  className={cn(
                    "hover:bg-inset flex items-center gap-3 py-3 pr-3 pl-3.5 transition-colors",
                    hideDeviating && session.deviating && "opacity-50",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">
                        {formatWeekdayDate(session.date)}
                      </span>
                      {session.deviating && <DeviatingBadge />}
                    </span>
                    <span className="text-muted text-xs">
                      {bestSet && `Bester Satz ${bestSet} · `}
                      {session.setCount} {session.setCount === 1 ? "Satz" : "Sätze"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="font-semibold tabular-nums">
                      {main !== null ? formatRecordValue(data.metric, main) : "–"}
                    </span>
                    {rowLabels[data.metric] && (
                      <span className="text-muted text-[0.6875rem]">{rowLabels[data.metric]}</span>
                    )}
                  </span>
                  <ChevronRight aria-hidden="true" className="text-muted size-4 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
