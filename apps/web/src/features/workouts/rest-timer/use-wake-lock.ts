import { useEffect } from "react";

/**
 * Hält den Bildschirm an, solange `active` gilt (Screen Wake Lock API). Der Browser gibt die
 * Sperre frei, sobald der Tab in den Hintergrund geht; beim Zurückkommen neu anfordern.
 * Ohne Unterstützung passiert nichts.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) void next.release();
        else sentinel = next;
      } catch {
        // Z. B. Energiesparmodus: dann eben ohne.
      }
    };

    void request();
    const onVisibility = () => void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
    };
  }, [active]);
}
