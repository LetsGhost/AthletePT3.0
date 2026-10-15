import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { errorMessage } from "@/lib/http";

import { Alert } from "./alert";
import { Button } from "./button";

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  /** Platzhalter in der Form des späteren Inhalts. */
  loading: ReactNode;
  children: (data: T) => ReactNode;
}

/** Einheitliche Lade- und Fehlerzustände für Abfragen, inklusive „Erneut versuchen“. */
export function QueryState<T>({ query, loading, children }: QueryStateProps<T>) {
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Wird geladen …</span>
        {loading}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert variant="error" title="Konnte nicht geladen werden">
        <p>{errorMessage(query.error)}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          loading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Erneut versuchen
        </Button>
      </Alert>
    );
  }
  return <>{children(query.data)}</>;
}

/** Graue Platzhalter-Zeilen mit Schimmer. */
export function SkeletonList({
  rows = 3,
  className = "h-20",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`skeleton rounded-card ${className}`} />
      ))}
    </div>
  );
}
