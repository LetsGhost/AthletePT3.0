import {
  STATS_SESSION_LIMIT,
  recordKindLabels,
  type ExerciseStatsDetail,
  type RecordKind,
  type StatsMetric,
} from "@athletept/shared";
import { Link } from "react-router";

import { formatWeekdayDate } from "@/features/workouts/format";
import { formatNumber } from "@/lib/format";

import { formatPercent, formatRecordValue, metricLabels } from "./format";
import { ProgressChart } from "./progress-chart";
import { ChangeBadge } from "./stats-overview";

const tileKinds: Record<StatsMetric, RecordKind[]> = {
  estimated1rm: ["estimated1rm", "topWeightKg", "maxReps"],
  topWeightKg: ["topWeightKg", "maxReps"],
  maxReps: ["maxReps"],
  maxDurationSeconds: ["maxDurationSeconds"],
};

const shortLabels: Record<StatsMetric, string> = {
  estimated1rm: "Gesch. Max.",
  topWeightKg: "Höchstes",
  maxReps: "Wdh.",
  maxDurationSeconds: "Dauer",
};

interface ExerciseProgressProps {
  data: ExerciseStatsDetail;
  logHref: (logId: string) => string;
}

/** Bestwerte, Verlauf der letzten Einheiten als Diagramm und als Tabelle. */
export function ExerciseProgress({ data, logHref }: ExerciseProgressProps) {
  const estimated = data.metric === "estimated1rm";
  const weighted = estimated || data.metric === "topWeightKg";
  const change = data.change;
  const summary = change
    ? `${metricLabels[data.metric]} von ${formatRecordValue(data.metric, change.from)} am ${formatWeekdayDate(change.fromDate)} auf ${formatRecordValue(data.metric, change.to)} (${formatPercent(change.percent)}).`
    : `${metricLabels[data.metric]}: noch zu wenige Einheiten für einen Verlauf.`;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Bestwerte" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {tileKinds[data.metric].map((kind) => {
          const record = data.best[kind];
          return (
            <div key={kind} className="bg-surface flex flex-col gap-1 rounded-card p-4">
              <span className="text-muted text-sm">{recordKindLabels[kind]}</span>
              <span className="text-2xl font-medium tabular-nums">
                {record ? formatRecordValue(kind, record.value) : "–"}
              </span>
              {record && (
                <span className="text-muted text-sm">am {formatWeekdayDate(record.date)}</span>
              )}
            </div>
          );
        })}
      </section>

      <section
        aria-labelledby="progress-chart"
        className="bg-surface flex flex-col gap-3 rounded-card p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="progress-chart" className="font-medium">
            Verlauf der letzten {Math.min(STATS_SESSION_LIMIT, data.sessions.length)} Einheiten
          </h2>
          <ChangeBadge summary={data} />
        </div>
        <p className="text-muted text-sm">
          {summary}
          {estimated && " Geschätzt aus Gewicht und Wiederholungen (Epley, bis 12 Wdh.)."}
        </p>
        {data.sessions.length > 1 && (
          <ProgressChart
            sessions={data.sessions}
            metric={data.metric}
            label={`Diagramm: ${summary} Die Werte stehen in der Tabelle darunter.`}
          />
        )}
      </section>

      <section className="bg-surface overflow-x-auto rounded-card p-4">
        <table className="w-full text-sm">
          <caption className="mb-2 text-left font-medium">Einheiten</caption>
          <thead className="text-muted text-left">
            <tr>
              <th scope="col" className="py-1 pr-3 font-normal">
                Datum
              </th>
              <th scope="col" className="py-1 pr-3 font-normal">
                {shortLabels[data.metric]}
              </th>
              {estimated && (
                <th scope="col" className="py-1 pr-3 font-normal">
                  Höchstes
                </th>
              )}
              {weighted && (
                <th scope="col" className="hidden py-1 pr-3 font-normal sm:table-cell">
                  Volumen
                </th>
              )}
              <th scope="col" className="py-1 font-normal">
                Sätze
              </th>
            </tr>
          </thead>
          <tbody>
            {[...data.sessions].reverse().map((session) => {
              const main = session[data.metric];
              return (
                <tr key={session.logId} className="border-border border-t">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal whitespace-nowrap">
                    <Link
                      to={logHref(session.logId)}
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      {formatWeekdayDate(session.date)}
                    </Link>
                  </th>
                  <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                    {main !== null ? formatRecordValue(data.metric, main) : "–"}
                  </td>
                  {estimated && (
                    <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                      {session.topWeightKg !== null
                        ? formatRecordValue("topWeightKg", session.topWeightKg)
                        : "–"}
                    </td>
                  )}
                  {weighted && (
                    <td className="hidden py-1.5 pr-3 whitespace-nowrap tabular-nums sm:table-cell">
                      {session.volumeKg !== null ? `${formatNumber(session.volumeKg)} kg` : "–"}
                    </td>
                  )}
                  <td className="py-1.5 tabular-nums">{session.setCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
