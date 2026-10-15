import { useEffect } from "react";
import { useBlocker } from "react-router";

/**
 * Warnt vor dem Verlassen der Seite mit ungespeicherten Änderungen: Browser-Dialog beim Schließen
 * oder Neuladen, `blocker` für einen eigenen Dialog bei Navigation innerhalb der App.
 */
export function useUnsavedChanges(dirty: boolean, submitting = false) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !submitting && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return blocker;
}
