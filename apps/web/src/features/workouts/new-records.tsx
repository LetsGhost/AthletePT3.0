import { recordKindLabels, type NewRecord } from "@athletept/shared";
import { Trophy } from "lucide-react";
import { Link } from "react-router";

import { formatRecordValue } from "@/features/stats/format";

/** Feiert neue Bestwerte direkt nach dem Training. */
export function NewRecords({ records }: { records: NewRecord[] }) {
  if (records.length === 0) return null;

  return (
    <section
      aria-labelledby="new-records"
      className="bg-surface border-module-records flex gap-3 rounded-card border-l-4 p-4 text-left"
    >
      <Trophy aria-hidden="true" className="text-module-records mt-0.5 size-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="new-records" className="font-medium">
          {records.length === 1 ? "Neuer Bestwert!" : "Neue Bestwerte!"}
        </h2>
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {records.map((record) => (
            <li key={`${record.exerciseId}-${record.kind}`}>
              <Link
                to={`/entwicklung/${record.exerciseId}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {record.exerciseName}
              </Link>
              : {recordKindLabels[record.kind]} {formatRecordValue(record.kind, record.value)}{" "}
              <span className="text-muted">
                (bisher {formatRecordValue(record.kind, record.previous)})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
