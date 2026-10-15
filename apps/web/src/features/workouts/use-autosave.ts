import type { WorkoutLog } from "@athletept/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/http";

import { saveWorkout, workoutKeys } from "./api";
import { draftFromLog, draftStorage, draftToRequest, type WorkoutDraft } from "./draft";

export type SaveState =
  "saved" | "pending" | "saving" | "offline" | "invalid" | "conflict" | "error";

/** Pause nach der letzten Eingabe, bevor gespeichert wird. */
export const AUTOSAVE_DELAY_MS = 1500;
/** Ohne Netz: so oft erneut versuchen (zusätzlich beim Event `online`). */
const RETRY_DELAY_MS = 10_000;

/**
 * Speichert den Entwurf verzögert auf dem Server. Bis dahin (und ohne Netz) liegt er im
 * localStorage, damit beim Training nichts verloren geht. Es läuft immer nur eine Anfrage; was
 * währenddessen eingegeben wird, geht mit der nächsten raus.
 */
export function useWorkoutAutosave(log: WorkoutLog, draft: WorkoutDraft, enabled: boolean) {
  const queryClient = useQueryClient();
  const revision = useRef(log.revision);
  // Was der Server schon hat. Ein wiederhergestellter lokaler Entwurf weicht davon ab.
  const lastSaved = useRef(JSON.stringify(draftFromLog(log)));
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft);
  useLayoutEffect(() => {
    latest.current = draft;
  });
  const [state, setState] = useState<SaveState>("saved");
  const serialized = JSON.stringify(draft);

  const save = useCallback(async (): Promise<void> => {
    while (inFlight.current) await inFlight.current;
    const json = JSON.stringify(latest.current);
    if (json === lastSaved.current) {
      setState("saved");
      return;
    }
    const { body, errors } = draftToRequest(latest.current, revision.current);
    if (Object.keys(errors).length > 0) {
      setState("invalid");
      return;
    }
    setState("saving");
    const run = (async () => {
      try {
        const saved = await saveWorkout(log.id, body);
        revision.current = saved.revision;
        lastSaved.current = json;
        queryClient.setQueryData(workoutKeys.mine(log.id), saved);
        if (JSON.stringify(latest.current) === json) {
          draftStorage.remove(log.id);
          setState("saved");
        } else {
          setState("pending");
        }
      } catch (error) {
        if (error instanceof ApiError && error.code === "workout_conflict") setState("conflict");
        else if (error instanceof ApiError && error.status === 0) setState("offline");
        else setState("error");
      }
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, [log.id, queryClient]);

  // Jede Änderung: sofort lokal sichern, verzögert an den Server.
  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return;
    draftStorage.write(log.id, { revision: revision.current, draft: latest.current });
    setState((s) => (s === "conflict" ? s : "pending"));
    timer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [serialized, enabled, log.id, save]);

  // Ohne Netz oder nach einem Fehler: erneut versuchen.
  useEffect(() => {
    if (!enabled || (state !== "offline" && state !== "error")) return;
    const retry = () => void save();
    window.addEventListener("online", retry);
    const interval = setInterval(retry, RETRY_DELAY_MS);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(interval);
    };
  }, [state, enabled, save]);

  /** Bricht das verzögerte Speichern ab, wartet laufende Anfragen ab und liefert den Stand. */
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    return draftToRequest(latest.current, revision.current);
  }, []);

  /** Nach Abschließen oder Verwerfen: lokalen Puffer löschen, nichts mehr senden. */
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    lastSaved.current = JSON.stringify(latest.current);
    draftStorage.remove(log.id);
  }, [log.id]);

  return { state, flush, clear };
}
