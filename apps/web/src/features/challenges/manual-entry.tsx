import { addDays, MAX_MANUAL_VALUE, type ChallengeDetail } from "@athletept/shared";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { toast } from "@/components/ui/toast-store";
import { formatWeekdayDate } from "@/features/workouts/format";
import { cn } from "@/lib/cn";
import { formatNumber, parseIsoDate } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { useSetMyEntry } from "./api";
import { ChallengeRing } from "./challenge-visuals";

const weekdayShort = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const QUICK_STEPS = [5, 10, 25] as const;

function useSaveEntry(challenge: ChallengeDetail) {
  const save = useSetMyEntry(challenge.id);
  return (value: number) =>
    save.mutate(
      { date: challenge.today, value },
      { onError: (error) => toast(errorMessage(error), "error") },
    );
}

/** Menge eintragen: Schnelltasten, gespeichert wird kurz nach der letzten Änderung. */
function QuantityEntry({ challenge }: { challenge: ChallengeDetail }) {
  const target = challenge.dailyTarget ?? 1;
  const saved = challenge.todayValue ?? 0;
  const [draft, setDraft] = useState(saved);
  const debounced = useDebouncedValue(draft, 600);
  const save = useSaveEntry(challenge);

  useEffect(() => {
    if (debounced !== saved) save(debounced);
    // Nur auf die entprellte Eingabe reagieren, nicht auf den gespeicherten Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const change = (delta: number) =>
    setDraft((value) => Math.max(0, Math.min(MAX_MANUAL_VALUE, value + delta)));
  const done = draft >= target;

  return (
    <div className="flex w-full flex-col items-center gap-3.5">
      <ChallengeRing
        kind={challenge.kind}
        ratio={draft / target}
        label={`${draft} von ${target}`}
        size={140}
      >
        <span className="text-4xl leading-none font-bold tabular-nums">{formatNumber(draft)}</span>
        <span className="text-muted text-xs">von {formatNumber(target)}</span>
      </ChallengeRing>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="5 weniger"
          onClick={() => change(-5)}
          disabled={draft === 0}
          className="border-border-strong bg-inset size-12 rounded-2xl border text-lg font-semibold disabled:opacity-40"
        >
          −5
        </button>
        {QUICK_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            aria-label={`${step} mehr`}
            onClick={() => change(step)}
            className="bg-challenge-coach/15 text-challenge-coach h-12 rounded-2xl px-4 text-base font-bold"
          >
            +{step}
          </button>
        ))}
      </div>
      <p
        aria-live="polite"
        className={cn("text-xs font-medium", done ? "text-challenge-coach" : "text-muted")}
      >
        {done ? "Tagesziel geschafft!" : `Noch ${formatNumber(target - draft)} bis zum Tagesziel`}
      </p>
    </div>
  );
}

function CheckEntry({ challenge }: { challenge: ChallengeDetail }) {
  const checked = (challenge.todayValue ?? 0) >= 1;
  const save = useSaveEntry(challenge);
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        aria-pressed={checked}
        aria-label="Heute erledigt"
        onClick={() => save(checked ? 0 : 1)}
        className={cn(
          "flex size-30 items-center justify-center rounded-[36px] transition-colors",
          checked
            ? "bg-challenge-coach text-bg"
            : "border-border-strong text-muted border-2 border-dashed",
        )}
      >
        <Check aria-hidden="true" className="size-14" strokeWidth={2.6} />
      </button>
      <p className="font-semibold">{checked ? "Heute erledigt" : "Heute noch offen"}</p>
      <p className="text-muted text-xs">Tippen zum Abhaken, rückgängig bis Mitternacht.</p>
    </div>
  );
}

/** Die letzten sieben Tage der Challenge mit Tageswert. */
function RecentDays({ challenge }: { challenge: ChallengeDetail }) {
  const target = challenge.manualMode === "quantity" ? (challenge.dailyTarget ?? 1) : 1;
  const byDate = new Map(challenge.entries.map((e) => [e.date, e.value]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(challenge.today, i - 6)).filter(
    (date) => date >= challenge.startDate,
  );
  const fulfilled = days.filter((d) => (byDate.get(d) ?? 0) >= target).length;

  return (
    <section aria-labelledby="recent-days" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-0.5">
        <h2 id="recent-days" className="font-semibold">
          Letzte Tage
        </h2>
        <span className="text-muted text-xs">
          {fulfilled} von {days.length} {days.length === 1 ? "Tag" : "Tagen"} geschafft
        </span>
      </div>
      <ol className="bg-surface grid grid-cols-7 gap-1.5 rounded-tile p-3.5">
        {days.map((date) => {
          const value = byDate.get(date) ?? 0;
          const full = value >= target;
          const today = date === challenge.today;
          return (
            <li key={date} className="flex flex-col items-center gap-1.5">
              <span
                className={cn("text-[10px]", today ? "text-challenge-coach" : "text-muted")}
                aria-hidden="true"
              >
                {weekdayShort.format(parseIsoDate(date)).replace(".", "")}
              </span>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl text-[11px] font-semibold",
                  full
                    ? "bg-challenge-coach/20 text-challenge-coach"
                    : today
                      ? "border-challenge-coach border-[1.5px] border-dashed"
                      : "bg-inset text-muted",
                )}
              >
                <span aria-hidden="true">
                  {full ? "✓" : value > 0 && challenge.manualMode === "quantity" ? value : "–"}
                </span>
                <span className="sr-only">
                  {formatWeekdayDate(date)}:{" "}
                  {full ? "geschafft" : value > 0 ? `${value} eingetragen` : "nichts eingetragen"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Eintragen einer freien Vorgabe, nur solange die Challenge läuft. */
export function ManualEntry({ challenge }: { challenge: ChallengeDetail }) {
  return (
    <>
      {challenge.status === "running" && (
        <section className="border-challenge-coach/30 bg-surface flex flex-col items-center gap-3.5 rounded-tile border px-4 py-4.5">
          <h2 className="text-muted text-sm font-normal">
            Heute · {formatWeekdayDate(challenge.today)}
          </h2>
          {challenge.manualMode === "quantity" ? (
            <QuantityEntry key={challenge.id} challenge={challenge} />
          ) : (
            <CheckEntry challenge={challenge} />
          )}
        </section>
      )}
      {challenge.status !== "planned" && <RecentDays challenge={challenge} />}
    </>
  );
}
