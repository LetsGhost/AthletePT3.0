import { useCallback, useEffect, useRef, useState } from "react";

import { jsonStore } from "@/lib/json-store";

import { playAlarm } from "./alarm";

/** So lange bleibt „Pause vorbei“ stehen, bevor der Timer verschwindet. */
export const REST_FINISHED_MS = 5000;
const TICK_MS = 250;

export interface RestTimer {
  exerciseId: string;
  exerciseName: string;
  /** Zeitpunkt (ms seit Epoche), an dem die Pause endet. */
  endsAt: number;
  /** Gesamtlänge in Sekunden, für den Fortschrittsbalken. */
  total: number;
}

/** Überlebt ein Neuladen der Seite; abgelaufene Timer werden verworfen. */
const restStorage = jsonStore<RestTimer>("athletept.rest.");

function readTimer(logId: string) {
  const timer = restStorage.read(logId);
  return timer && timer.endsAt + REST_FINISHED_MS > Date.now() ? timer : null;
}

/**
 * Pausen-Timer zwischen den Sätzen. Rechnet immer vom Endzeitpunkt aus, damit die Anzeige stimmt,
 * auch wenn der Browser Timer im Hintergrund bremst oder der Bildschirm gesperrt war.
 */
export function useRestTimer(logId: string) {
  const [timer, setTimerState] = useState(() => readTimer(logId));
  const [now, setNow] = useState(() => Date.now());
  const alarmedFor = useRef<number | null>(null);

  const setTimer = useCallback(
    (next: RestTimer | null) => {
      if (next) restStorage.write(logId, next);
      else restStorage.remove(logId);
      setTimerState(next);
      setNow(Date.now());
    },
    [logId],
  );

  useEffect(() => {
    if (!timer) return;
    const update = () => {
      const current = Date.now();
      if (current >= timer.endsAt + REST_FINISHED_MS) setTimer(null);
      else setNow(current);
    };
    const id = setInterval(update, TICK_MS);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [timer, setTimer]);

  const remaining = timer
    ? Math.min(timer.total, Math.max(0, Math.ceil((timer.endsAt - now) / 1000)))
    : 0;
  const finished = timer !== null && remaining === 0;

  // Nur beim Übergang auf 0 alarmieren, nicht nach einem Neuladen mit abgelaufenem Timer.
  useEffect(() => {
    if (!timer) return;
    if (!finished) {
      alarmedFor.current = null;
      return;
    }
    if (alarmedFor.current === timer.endsAt) return;
    alarmedFor.current = timer.endsAt;
    playAlarm();
  }, [timer, finished]);

  const start = useCallback(
    (exerciseId: string, exerciseName: string, seconds: number) =>
      setTimer({ exerciseId, exerciseName, endsAt: Date.now() + seconds * 1000, total: seconds }),
    [setTimer],
  );

  /** Verlängert oder verkürzt die laufende Pause, höchstens bis auf 1 Sekunde. */
  const adjust = useCallback(
    (seconds: number) => {
      if (!timer) return;
      const left = Math.max(1, Math.ceil((timer.endsAt - Date.now()) / 1000) + seconds);
      setTimer({ ...timer, endsAt: Date.now() + left * 1000, total: Math.max(timer.total, left) });
    },
    [timer, setTimer],
  );

  const stop = useCallback(() => setTimer(null), [setTimer]);

  return { timer, remaining, finished, start, adjust, stop };
}

export type RestTimerControls = ReturnType<typeof useRestTimer>;
