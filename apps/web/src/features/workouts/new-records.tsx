import {
  estimateOneRepMax,
  type NewRecord,
  type RecordKind,
  type WorkoutExercise,
  type WorkoutSet,
} from "@athletept/shared";
import { Trophy } from "lucide-react";
import { Link } from "react-router";

import { formatDuration } from "@/features/plans/format";
import { formatRecordValue } from "@/features/stats/format";
import { formatNumber } from "@/lib/format";

import { DeviatingBadge } from "./deviating-badge";
import { formatPerformed } from "./format";

/** Pro Übung zählt der anschaulichste Bestwert: Gewicht vor Maximum vor Wdh. vor Dauer. */
const kindOrder: RecordKind[] = ["topWeightKg", "estimated1rm", "maxReps", "maxDurationSeconds"];

/** Wert, nach dem der Satz für den Bestwert ausgewählt wird. */
const setScore: Record<RecordKind, (set: WorkoutSet) => number> = {
  // Bei gleichem Gewicht gewinnt der Satz mit mehr Wiederholungen.
  topWeightKg: (set) => (set.weightKg ?? 0) * 1000 + (set.reps ?? 0),
  estimated1rm: (set) => estimateOneRepMax(set.weightKg, set.reps) ?? 0,
  maxReps: (set) => set.reps ?? 0,
  maxDurationSeconds: (set) => set.durationSeconds ?? 0,
};

function formatGain(kind: RecordKind, gain: number) {
  if (kind === "maxReps") return `+${gain} Wdh.`;
  if (kind === "maxDurationSeconds") return `+${formatDuration(gain)}`;
  return `+${formatNumber(Math.round(gain * 10) / 10)} kg`;
}

function describe(record: NewRecord) {
  if (record.kind === "topWeightKg") return "Schwerstes Gewicht";
  if (record.kind === "estimated1rm") {
    return `Geschätztes Max. ${formatRecordValue(record.kind, record.value)}`;
  }
  if (record.kind === "maxReps") return "Meiste Wiederholungen";
  return "Längste Dauer";
}

const recordExercise = (record: NewRecord, exercises: readonly WorkoutExercise[]) =>
  exercises.find((x) => x.exerciseId === record.exerciseId && !x.skipped);

/** Erledigter Arbeitssatz, mit dem der Bestwert aufgestellt wurde. */
function recordSet(record: NewRecord, exercises: readonly WorkoutExercise[]) {
  const exercise = recordExercise(record, exercises);
  const sets = exercise?.sets.filter((s) => s.done && s.kind === "working") ?? [];
  const score = setScore[record.kind];
  return sets.reduce<WorkoutSet | null>(
    (best, set) => (best === null || score(set) > score(best) ? set : best),
    null,
  );
}

/** Ein Eintrag je Übung mit ihrem wichtigsten neuen Bestwert. */
function headlineRecords(records: readonly NewRecord[]) {
  const byExercise = new Map<string, NewRecord>();
  for (const record of records) {
    const current = byExercise.get(record.exerciseId);
    if (!current || kindOrder.indexOf(record.kind) < kindOrder.indexOf(current.kind)) {
      byExercise.set(record.exerciseId, record);
    }
  }
  return [...byExercise.values()];
}

interface NewRecordsProps {
  records: NewRecord[];
  exercises: WorkoutExercise[];
}

/** Feiert neue Bestwerte direkt nach dem Training. */
export function NewRecords({ records, exercises }: NewRecordsProps) {
  const rows = headlineRecords(records);
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="new-records"
      className="bg-surface border-module-records/40 flex flex-col gap-3 rounded-tile border p-4"
    >
      <div className="flex items-center gap-3">
        <span className="bg-module-records/15 text-module-records flex size-10 shrink-0 items-center justify-center rounded-card">
          <Trophy aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="new-records" className="text-lg leading-tight font-semibold">
            {rows.length === 1 ? "1 neue Bestleistung" : `${rows.length} neue Bestleistungen`}
          </h2>
          <p className="text-muted text-sm">So stark warst du hier noch nie</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((record) => {
          const set = recordSet(record, exercises);
          return (
            <li key={record.exerciseId}>
              <Link
                to={`/fortschritt/${record.exerciseId}`}
                className="bg-inset hover:border-border-strong flex items-center gap-3 rounded-card border border-transparent px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{record.exerciseName}</span>
                  <span className="text-muted block text-sm">{describe(record)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end text-right tabular-nums">
                  {recordExercise(record, exercises)?.deviating && <DeviatingBadge />}
                  <span className="block font-semibold">
                    {set ? formatPerformed(set) : formatRecordValue(record.kind, record.value)}
                  </span>
                  <span className="text-module-records block text-sm font-medium">
                    {formatGain(record.kind, record.value - record.previous)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
