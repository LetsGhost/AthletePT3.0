import { useEffect, useState } from "react";

/** Sekunden seit `since`, jede Sekunde neu berechnet, solange `active` gilt. */
export function useElapsedSeconds(since: string, active: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const update = () => setNow(Date.now());
    const id = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [active]);

  return Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
}
