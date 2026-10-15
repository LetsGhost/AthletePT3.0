import { QueryClient } from "@tanstack/react-query";

import { useSession } from "@/features/auth/session";
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

/**
 * Leert den Cache, sobald sich der angemeldete User ändert: Logout (auch in einem anderen Tab),
 * abgelaufene Sitzung, Login oder angenommene Einladung. Die Query-Keys enthalten keine User-ID,
 * sonst sähe der nächste User im selben Tab kurz die Daten des vorherigen.
 */
export function clearCacheOnUserChange(queryClient: QueryClient) {
  return useSession.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id) queryClient.clear();
  });
}
