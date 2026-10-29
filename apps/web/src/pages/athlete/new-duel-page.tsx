import {
  DUEL_DURATIONS,
  DUEL_INVITE_DAYS,
  duelMetricLabels,
  emailSchema,
  MAX_OPEN_DUELS,
  type ChallengeDetail,
  type DuelMetric,
} from "@athletept/shared";
import { ArrowLeft, Info, Mail, Swords } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { useCreateDuel } from "@/features/challenges/api";
import { metricGroupIcon } from "@/features/challenges/tones";
import { useMyStats } from "@/features/stats/api";
import { cn } from "@/lib/cn";
import { ApiError, errorMessage } from "@/lib/http";

const groups: {
  name: string;
  icon: keyof typeof metricGroupIcon;
  items: [DuelMetric, string][];
}[] = [
  {
    name: "Konstanz",
    icon: "consistency",
    items: [
      ["training_days", "Tage mit mindestens einem erledigten Training"],
      ["workouts", "Jedes erledigte Training zählt"],
    ],
  },
  {
    name: "Volumen",
    icon: "volume",
    items: [
      ["volume", "Bewegte kg aller Arbeitssätze"],
      ["sets", "Erledigte Arbeitssätze"],
    ],
  },
  {
    name: "Leistung",
    icon: "performance",
    items: [["e1rm", "Bestes geschätztes Maximum bei einer Übung"]],
  },
];

const durationInfo: Record<number, { name: string; description: string }> = {
  7: { name: "1 Woche", description: "Kurz und knackig" },
  14: { name: "2 Wochen", description: "Der Klassiker" },
  28: { name: "4 Wochen", description: "Für den langen Atem" },
};

const STEP_NAMES = ["Metrik", "Laufzeit", "Gegner"] as const;

function Option({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
        selected
          ? "border-challenge-duel bg-challenge-duel/10"
          : "bg-surface hover:border-border-strong border-transparent",
      )}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5.5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-challenge-duel" : "border-border-strong",
        )}
      >
        {selected && <span className="bg-challenge-duel size-2.5 rounded-full" />}
      </span>
    </button>
  );
}

function Sent({ duel }: { duel: ChallengeDetail }) {
  return (
    <div className="flex flex-col items-center gap-3.5 px-2 py-10 text-center">
      <span className="bg-challenge-duel/15 animate-pop-in flex size-19 items-center justify-center rounded-3xl">
        <Mail aria-hidden="true" className="text-challenge-duel size-9" />
      </span>
      <h1 className="text-[22px] font-semibold">Einladung ist unterwegs</h1>
      <p className="text-muted max-w-xs text-sm leading-relaxed">
        Wenn ein Athlet mit dieser E-Mail existiert, bekommt er die Einladung. Nimmt er innerhalb
        von {DUEL_INVITE_DAYS} Tagen an, startet euer Duell.
      </p>
      <Link
        to={`/challenges/${duel.id}`}
        className="bg-surface hover:bg-inset mt-1.5 flex w-full items-center gap-3 rounded-tile px-3.5 py-3 text-left"
      >
        <span className="bg-challenge-duel/15 flex size-9 items-center justify-center rounded-xl">
          <Swords aria-hidden="true" className="text-challenge-duel size-5" />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-sm font-semibold">
            {duel.title}
            {duel.exerciseName && ` · ${duel.exerciseName}`}
          </span>
          <span className="text-muted text-xs">
            {durationInfo[duel.duel?.durationDays ?? 7]?.name} · wartet auf Antwort
          </span>
        </span>
      </Link>
      <Button asChild className="mt-2 w-full">
        <Link to="/challenges">Zur Übersicht</Link>
      </Button>
    </div>
  );
}

export default function NewDuelPage() {
  const create = useCreateDuel();
  const stats = useMyStats();
  const [step, setStep] = useState(0);
  const [metric, setMetric] = useState<DuelMetric>("training_days");
  const [exerciseId, setExerciseId] = useState("");
  const [durationDays, setDurationDays] = useState<number>(14);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<ChallengeDetail | null>(null);

  const validEmail = emailSchema.safeParse(email).success;
  const exercises = stats.data?.items ?? [];
  const exerciseName = exercises.find((e) => e.exerciseId === exerciseId)?.exerciseName;

  const next = async () => {
    setError(null);
    if (step === 0 && metric === "e1rm" && !exerciseId) {
      setError("Bitte wähle eine Übung.");
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (!validEmail) {
      setError("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    try {
      setSent(
        await create.mutateAsync({
          metric,
          exerciseId: metric === "e1rm" ? exerciseId : null,
          durationDays,
          email,
        }),
      );
    } catch (submitError) {
      setError(
        submitError instanceof ApiError && submitError.code === "duel_limit"
          ? `Du hast schon ${MAX_OPEN_DUELS} offene Duelle. Schließ eins ab oder warte, bis eine Einladung verfällt.`
          : errorMessage(submitError),
      );
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md">
        <title>Duell starten · AthletePT</title>
        <Sent duel={sent} />
      </div>
    );
  }

  const summary = `${duelMetricLabels[metric]}${metric === "e1rm" && exerciseName ? ` · ${exerciseName}` : ""}`;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <title>Duell starten · AthletePT</title>
      <Link to="/challenges" className="text-muted inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft aria-hidden="true" className="size-4" /> Challenges
      </Link>
      <div className="flex flex-col gap-2">
        <div aria-hidden="true" className="grid grid-cols-3 gap-1.5">
          {STEP_NAMES.map((name, index) => (
            <span
              key={name}
              className={cn("h-1 rounded-full", index <= step ? "bg-challenge-duel" : "bg-border")}
            />
          ))}
        </div>
        <p className="text-muted text-xs">
          Schritt {step + 1} von 3 · {STEP_NAMES[step]}
        </p>
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-3.5">
          <h1 className="text-[22px] font-semibold">Worum duelliert ihr euch?</h1>
          {groups.map((group) => {
            const Icon = metricGroupIcon[group.icon];
            return (
              <div key={group.name} className="flex flex-col gap-1.5">
                <span className="text-muted flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Icon aria-hidden="true" className="size-3.5" /> {group.name}
                </span>
                <div role="radiogroup" aria-label={group.name} className="flex flex-col gap-1.5">
                  {group.items.map(([value, description]) => (
                    <Option
                      key={value}
                      selected={metric === value}
                      onSelect={() => setMetric(value)}
                    >
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold">{duelMetricLabels[value]}</span>
                        <span className="text-muted text-xs">{description}</span>
                      </span>
                    </Option>
                  ))}
                </div>
              </div>
            );
          })}
          {metric === "e1rm" && (
            <SelectField
              label="Übung"
              value={exerciseId}
              onChange={(event) => setExerciseId(event.target.value)}
              placeholder={exercises.length ? "Übung wählen" : "Noch keine Übung trainiert"}
              options={exercises.map((e) => ({ value: e.exerciseId, label: e.exerciseName }))}
              hint="Zur Auswahl stehen Übungen, die du schon trainiert hast."
            />
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3.5">
          <div>
            <h1 className="text-[22px] font-semibold">Wie lange?</h1>
            <p className="text-muted text-sm">Das Duell startet, sobald dein Gegner annimmt.</p>
          </div>
          <div role="radiogroup" aria-label="Laufzeit" className="flex flex-col gap-2">
            {DUEL_DURATIONS.map((days) => (
              <Option
                key={days}
                selected={durationDays === days}
                onSelect={() => setDurationDays(days)}
              >
                <span className="bg-inset flex size-12 shrink-0 flex-col items-center justify-center rounded-xl">
                  <span className="text-lg leading-none font-bold">{days / 7}</span>
                  <span className="text-muted text-[10px]">{days === 7 ? "Woche" : "Wochen"}</span>
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{durationInfo[days]!.name}</span>
                  <span className="text-muted text-xs">{durationInfo[days]!.description}</span>
                </span>
              </Option>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3.5">
          <div>
            <h1 className="text-[22px] font-semibold">Wen forderst du heraus?</h1>
            <p className="text-muted text-sm">Gib die E-Mail-Adresse deines Gegners ein.</p>
          </div>
          <TextField
            label="E-Mail des Gegners"
            type="email"
            autoComplete="email"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            hint="Wir verraten nie, ob es zu dieser Adresse ein Konto gibt."
          />
          <dl className="bg-surface flex flex-col gap-2.5 rounded-tile p-3.5 text-sm">
            <dt className="text-muted text-xs">Zusammenfassung</dt>
            {[
              ["Wertung", summary],
              ["Laufzeit", durationInfo[durationDays]!.name],
              ["Einladung gültig", `${DUEL_INVITE_DAYS} Tage`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted flex gap-2 text-xs leading-relaxed">
            <Info aria-hidden="true" className="size-4 shrink-0" />
            Dein Gegner sieht nur deinen Vornamen und den ersten Buchstaben deines Nachnamens, außer
            ihr habt denselben Coach.
          </p>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      <div className="border-border flex gap-2 border-t pt-3">
        {step > 0 && (
          <Button variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>
            Zurück
          </Button>
        )}
        <Button
          className="bg-challenge-duel text-bg hover:bg-challenge-duel flex-[1.6] hover:opacity-90"
          loading={create.isPending}
          onClick={() => void next()}
        >
          {step === 2 ? "Einladung senden" : "Weiter"}
        </Button>
      </div>
    </div>
  );
}
