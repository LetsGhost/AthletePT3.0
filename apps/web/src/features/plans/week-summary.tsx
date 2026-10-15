import { detectPlanType } from "@athletept/shared";
import { useId } from "react";

import { typeInputs, workingSets, type InfoMap } from "./editor-helpers";
import type { EditorDay } from "./editor-values";
import { coarseGroups, workingSetsPerGroup } from "./muscle-groups";
import { PlanTypeBadge } from "./plan-type-badge";

/** „Woche im Überblick“: Schwerpunkt, Kennzahlen und Arbeitssätze pro Muskelgruppe, live. */
export function WeekSummary({
  days,
  infos,
}: {
  days: readonly (Partial<EditorDay> | undefined)[];
  infos: InfoMap;
}) {
  const id = useId();
  const planType = detectPlanType(days.flatMap((day) => typeInputs(day?.exercises, infos)));
  const entries = days.flatMap((day) =>
    (day?.exercises ?? []).map((entry) => ({
      info: entry.exerciseId ? infos[entry.exerciseId] : undefined,
      workingSets: workingSets(entry.sets),
    })),
  );
  const volume = workingSetsPerGroup(entries);
  const maxVolume = Math.max(12, ...Object.values(volume));
  const totalSets = entries.reduce((sum, entry) => sum + entry.workingSets, 0);

  return (
    <section aria-labelledby={id} className="bg-surface flex flex-col gap-3.5 rounded-tile p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="font-medium">
          Woche im Überblick
        </h2>
        <PlanTypeBadge type={planType} />
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Tage", days.length],
          ["Übungen", entries.length],
          ["Arbeitssätze", totalSets],
        ].map(([label, value]) => (
          <div key={label} className="bg-inset flex flex-col rounded-card p-2.5">
            <dt className="text-muted order-last text-xs">{label}</dt>
            <dd className="text-xl font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <h3 className="text-muted text-xs font-normal">Arbeitssätze pro Muskelgruppe</h3>
        <ul className="flex flex-col gap-2">
          {coarseGroups.map((group) => (
            <li
              key={group}
              className="grid grid-cols-[4.75rem_minmax(0,1fr)_1.75rem] items-center gap-2.5 text-xs"
            >
              <span>{group}</span>
              <span aria-hidden="true" className="bg-inset h-2 overflow-hidden rounded-full">
                <span
                  className="bg-accent block h-full rounded-full transition-[width]"
                  style={{ width: `${Math.round((volume[group] / maxVolume) * 100)}%` }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">{volume[group]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
