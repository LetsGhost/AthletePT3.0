import { cn } from "@/lib/cn";

/** Zahl in der Kachel: wirkt wie Text, zeigt beim Überfahren und Fokus einen Rahmen. */
export const tileInput = cn(
  "h-9 rounded-lg border border-transparent bg-transparent p-0 text-center text-xl font-medium",
  "hover:border-border-strong focus-visible:border-accent focus-visible:outline-none",
  "aria-[invalid=true]:border-danger",
);
export const pillInput = cn(tileInput, "h-7 text-sm font-medium");

export type SetMode = "reps" | "duration";

/** Eingabefelder eines Satzes, in der Reihenfolge der Fehlermeldungen. */
export const setFields = ["repsMin", "repsMax", "durationSeconds", "weightKg", "rir"] as const;
