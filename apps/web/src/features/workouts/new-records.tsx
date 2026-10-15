import { recordKindLabels, type NewRecord } from "@athletept/shared";
import { Trophy, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";

import { formatRecordValue } from "@/features/stats/format";

/** Übergabe nach dem Abschließen eines Trainings an die Übersicht. */
export interface DashboardState {
  newRecords: NewRecord[];
}

/**
 * Feiert neue Bestwerte direkt nach dem Training. Bleibt sichtbar, bis der Athlet sie schließt;
 * nach einem Neuladen ist sie weg (Navigationszustand).
 */
export function NewRecordsAlert() {
  const location = useLocation();
  const navigate = useNavigate();
  const records = (location.state as DashboardState | null)?.newRecords ?? [];
  if (records.length === 0) return null;

  return (
    <section
      aria-labelledby="new-records"
      className="bg-surface border-module-records mb-4 flex gap-3 rounded-card border-l-4 p-4"
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
                to={`/progress/${record.exerciseId}`}
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
      <button
        type="button"
        aria-label="Hinweis schließen"
        className="text-muted hover:text-text hover:bg-inset -mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-card"
        onClick={() => navigate(".", { replace: true, state: null })}
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </section>
  );
}
