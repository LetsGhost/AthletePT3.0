import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/http";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client-Fehler (4xx) nicht wiederholen, nur Netzwerk- und Serverfehler.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}
