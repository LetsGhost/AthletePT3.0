import {
  addDays,
  challengeMetricGroupLabels,
  challengeMetricLabels,
  challengeScoringLabels,
  daysInPeriod,
  MAX_CHALLENGE_DAYS,
  manualModeLabels,
  todayIsoDate,
  type ChallengeMetric,
  type ChallengeMetricGroup,
  type ChallengeScoring,
  type CreateCoachChallengeRequest,
  type ManualMode,
} from "@athletept/shared";
import { ArrowLeft, Check, Gift, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { useAthletes } from "@/features/athletes/api";
import { useCreateChallenge } from "@/features/challenges/api";
import { ChallengeBar, KindBadge, MetricChip } from "@/features/challenges/challenge-visuals";
import { formatPeriod, formatScore } from "@/features/challenges/format";
import { metricGroupIcon } from "@/features/challenges/tones";
import { useExerciseSearch } from "@/features/exercises/api";
import { cn } from "@/lib/cn";
import { initials, parseIsoDate } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const STEPS = ["Metrik", "Wertung", "Zeitraum", "Teilnehmer", "Details", "Vorschau"] as const;

interface MetricGroupOption {
  group: ChallengeMetricGroup;
  description: string;
  metrics: ChallengeMetric[];
}

const metricGroups: MetricGroupOption[] = [
  {
    group: "consistency",
    description: "Trainingstage oder erledigte Trainings im Zeitraum.",
    metrics: ["workouts", "training_days"],
  },
  {
    group: "volume",
    description: "Bewegte kg oder Arbeitssätze, gut für Team-Ziele.",
    metrics: ["volume", "sets"],
  },
  {
    group: "performance",
    description: "Bestes geschätztes Maximum (e1RM) bei einer Übung.",
    metrics: ["e1rm"],
  },
  {
    group: "manual",
    description: "Eigene Aufgabe, Athleten tragen selbst ein, z. B. „100 Klimmzüge am Tag“.",
    metrics: ["manual"],
  },
];

const scoringDescriptions: Record<ChallengeScoring, string> = {
  goal: "Jeder, der das Ziel erreicht, hat gewonnen.",
  team_goal: "Alle sammeln gemeinsam auf ein großes Ziel.",
  ranking: "Wer am Ende vorne liegt, gewinnt.",
};

/** Einheit des Zielwerts im Formular. */
const goalUnit: Record<ChallengeMetric, string> = {
  workouts: "Trainings",
  training_days: "Tage",
  volume: "kg",
  sets: "Sätze",
  e1rm: "kg",
  manual: "Tage",
};

const titleSuggestion: Record<ChallengeMetric, string> = {
  workouts: "Konstanz-Challenge",
  training_days: "Trainingstage-Challenge",
  volume: "Volumen-Challenge",
  sets: "Satz-Challenge",
  e1rm: "Rekord-Challenge",
  manual: "",
};

interface Draft {
  group: ChallengeMetricGroup | null;
  metric: ChallengeMetric | null;
  exercise: { id: string; name: string } | null;
  manualMode: ManualMode;
  dailyTarget: string;
  scoring: ChallengeScoring;
  goal: string;
  startDate: string;
  endDate: string;
  participantIds: string[];
  title: string;
  description: string;
  prize: string;
}

function endOfMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  const next =
    month === 12 ? `${year! + 1}-01-01` : `${year}-${String(month! + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
}

const presets = [
  { label: "1 Woche", end: (start: string) => addDays(start, 6) },
  { label: "2 Wochen", end: (start: string) => addDays(start, 13) },
  { label: "4 Wochen", end: (start: string) => addDays(start, 27) },
  { label: "Bis Monatsende", end: endOfMonth },
] as const;

const positive = (value: string) => {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** Fehler des Schritts, `null` = alles da. */
function stepError(step: number, draft: Draft, today: string): string | null {
  switch (step) {
    case 0:
      if (!draft.metric) return "Bitte wähle, was gemessen wird.";
      if (draft.metric === "e1rm" && !draft.exercise) return "Bitte wähle eine Übung.";
      if (draft.metric === "manual") {
        if (draft.title.trim().length < 3) return "Bitte beschreibe die Aufgabe (mind. 3 Zeichen).";
        if (draft.manualMode === "quantity" && !Number.isInteger(positive(draft.dailyTarget))) {
          return "Bitte gib ein Tagesziel als ganze Zahl an.";
        }
      }
      return null;
    case 1:
      if (draft.scoring !== "ranking" && positive(draft.goal) === null) {
        return "Bitte gib ein Ziel größer als 0 an.";
      }
      return null;
    case 2:
      if (draft.startDate < today) return "Der Start darf nicht in der Vergangenheit liegen.";
      if (draft.endDate < draft.startDate) return "Das Ende liegt vor dem Start.";
      if (daysInPeriod(draft.startDate, draft.endDate) > MAX_CHALLENGE_DAYS) {
        return `Eine Challenge dauert höchstens ${MAX_CHALLENGE_DAYS} Tage.`;
      }
      if (
        draft.metric === "manual" &&
        draft.scoring === "goal" &&
        (positive(draft.goal) ?? 0) > daysInPeriod(draft.startDate, draft.endDate)
      ) {
        return "Das Ziel hat mehr Tage, als die Challenge dauert.";
      }
      return null;
    case 3:
      return draft.participantIds.length === 0 ? "Bitte wähle mindestens einen Athleten." : null;
    case 4:
      return draft.title.trim().length < 3 ? "Bitte gib einen Titel an (mind. 3 Zeichen)." : null;
    default:
      return null;
  }
}

function toRequest(draft: Draft): CreateCoachChallengeRequest {
  const manual = draft.metric === "manual";
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    metric: draft.metric!,
    exerciseId: draft.exercise?.id ?? null,
    manualMode: manual ? draft.manualMode : null,
    dailyTarget: manual && draft.manualMode === "quantity" ? positive(draft.dailyTarget) : null,
    scoring: draft.scoring,
    goalValue: draft.scoring === "ranking" ? null : positive(draft.goal),
    startDate: draft.startDate,
    endDate: draft.endDate,
    participantIds: draft.participantIds,
    prize: draft.prize.trim() || null,
  };
}

function ChoiceCard({
  selected,
  onSelect,
  children,
  role = "radio",
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  role?: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-tile border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/20"
          : "bg-surface hover:border-border-strong border-transparent",
      )}
    >
      {children}
    </button>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted text-sm">{description}</p>
    </div>
  );
}

function ExercisePicker({
  value,
  onChange,
  optional,
}: {
  value: Draft["exercise"];
  onChange: (exercise: Draft["exercise"]) => void;
  optional: boolean;
}) {
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim(), 250);
  const results = useExerciseSearch({ search }, { enabled: search.length >= 2, limit: 6 });

  if (value) {
    return (
      <div className="bg-surface flex items-center justify-between gap-3 rounded-tile p-3.5">
        <span className="flex flex-col">
          <span className="text-muted text-xs">Übung</span>
          <span className="font-medium">{value.name}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          {optional ? "Entfernen" : "Ändern"}
        </Button>
      </div>
    );
  }
  return (
    <div className="bg-surface flex flex-col gap-2 rounded-tile p-3.5">
      <TextField
        label={optional ? "Nur eine Übung (optional)" : "Übung"}
        placeholder="z. B. Kniebeuge"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        hint={optional ? "Leer lassen, dann zählen alle Übungen." : undefined}
      />
      {search.length >= 2 && (
        <ul className="flex flex-col gap-1" aria-label="Treffer">
          {results.data?.items.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => onChange({ id: exercise.id, name: exercise.name })}
                className="hover:bg-inset w-full rounded-card px-3 py-2 text-left text-sm"
              >
                {exercise.name}
              </button>
            </li>
          ))}
          {results.data?.items.length === 0 && (
            <li className="text-muted px-3 py-2 text-sm">Keine Übung gefunden.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function MetricStep({ draft, update }: StepProps) {
  const group = metricGroups.find((g) => g.group === draft.group);
  return (
    <div className="flex flex-col gap-4">
      <StepHeading
        title="Was wird gemessen?"
        description="Automatisch aus erledigten Trainings oder eine freie Vorgabe, die Athleten selbst eintragen."
      />
      <div role="radiogroup" aria-label="Metrik" className="grid gap-2.5 sm:grid-cols-2">
        {metricGroups.map((option) => {
          const Icon = metricGroupIcon[option.group];
          const manual = option.group === "manual";
          return (
            <ChoiceCard
              key={option.group}
              selected={draft.group === option.group}
              onSelect={() =>
                update({
                  group: option.group,
                  metric: option.metrics[0]!,
                  exercise: null,
                  ...(manual ? { title: "" } : {}),
                })
              }
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  manual ? "bg-challenge-coach/15" : "bg-challenge-system/15",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-5",
                    manual ? "text-challenge-coach" : "text-challenge-system",
                  )}
                />
              </span>
              <span className="font-semibold">{challengeMetricGroupLabels[option.group]}</span>
              <span className="text-muted text-xs leading-relaxed">{option.description}</span>
            </ChoiceCard>
          );
        })}
      </div>
      {group && group.metrics.length > 1 && (
        <SelectField
          label="Genauer"
          value={draft.metric ?? ""}
          onChange={(event) => update({ metric: event.target.value as ChallengeMetric })}
          options={group.metrics.map((m) => ({ value: m, label: challengeMetricLabels[m] }))}
          className="max-w-xs"
        />
      )}
      {(draft.metric === "volume" || draft.metric === "sets" || draft.metric === "e1rm") && (
        <ExercisePicker
          value={draft.exercise}
          onChange={(exercise) => update({ exercise })}
          optional={draft.metric !== "e1rm"}
        />
      )}
      {draft.metric === "manual" && (
        <div className="bg-surface grid gap-3 rounded-tile p-4 sm:grid-cols-[2fr_1fr]">
          <TextField
            label="Aufgabe"
            placeholder="z. B. 100 Klimmzüge am Tag"
            value={draft.title}
            maxLength={60}
            onChange={(event) => update({ title: event.target.value })}
          />
          <SelectField
            label="Eintragen als"
            value={draft.manualMode}
            onChange={(event) => update({ manualMode: event.target.value as ManualMode })}
            options={(["quantity", "check"] as const).map((m) => ({
              value: m,
              label: manualModeLabels[m],
            }))}
          />
          {draft.manualMode === "quantity" && (
            <TextField
              label="Tagesziel"
              inputMode="numeric"
              placeholder="100"
              value={draft.dailyTarget}
              onChange={(event) => update({ dailyTarget: event.target.value })}
              className="max-w-40"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ScoringStep({ draft, update }: StepProps) {
  const metric = draft.metric!;
  return (
    <div className="flex flex-col gap-4">
      <StepHeading
        title="Wie wird gewertet?"
        description="Ein Ziel kann jeder schaffen, eine Rangliste kürt die Besten."
      />
      <div role="radiogroup" aria-label="Wertung" className="grid gap-2.5 sm:grid-cols-3">
        {(["goal", "team_goal", "ranking"] as const).map((scoring) => (
          <ChoiceCard
            key={scoring}
            selected={draft.scoring === scoring}
            onSelect={() => update({ scoring })}
          >
            <span className="font-semibold">{challengeScoringLabels[scoring]}</span>
            <span className="text-muted text-xs leading-relaxed">
              {scoringDescriptions[scoring]}
            </span>
          </ChoiceCard>
        ))}
      </div>
      {draft.scoring !== "ranking" && (
        <TextField
          label={draft.scoring === "team_goal" ? "Ziel fürs ganze Team" : "Ziel je Athlet"}
          inputMode="decimal"
          value={draft.goal}
          onChange={(event) => update({ goal: event.target.value })}
          trailing={<span className="text-muted pr-3 text-sm">{goalUnit[metric]}</span>}
          hint={
            metric === "manual"
              ? "Tage, an denen das Tagesziel erreicht bzw. abgehakt wird."
              : metric === "e1rm"
                ? "Geschätztes Maximum, das erreicht werden soll."
                : undefined
          }
          className="max-w-xs"
        />
      )}
    </div>
  );
}

function PeriodStep({ draft, update }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeading
        title="Wann läuft die Challenge?"
        description="Gezählt wird nur, was in diesem Zeitraum erledigt wird."
      />
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const end = preset.end(draft.startDate);
          const active = draft.endDate === end;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => update({ endDate: end })}
              className={cn(
                "h-9 rounded-full px-3.5 text-sm",
                active ? "bg-text text-bg" : "border-border-strong border",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="grid max-w-md grid-cols-2 gap-3">
        <TextField
          label="Start"
          type="date"
          value={draft.startDate}
          min={todayIsoDate()}
          onChange={(event) => update({ startDate: event.target.value })}
        />
        <TextField
          label="Ende"
          type="date"
          value={draft.endDate}
          min={draft.startDate}
          onChange={(event) => update({ endDate: event.target.value })}
        />
      </div>
    </div>
  );
}

function ParticipantsStep({ draft, update }: StepProps) {
  const athletes = useAthletes();
  return (
    <QueryState query={athletes} loading={<SkeletonList rows={3} className="h-12" />}>
      {({ items }) => {
        const available = items.filter((a) => a.status !== "disabled");
        const allSelected =
          available.length > 0 && available.every((a) => draft.participantIds.includes(a.id));
        if (available.length === 0) {
          return (
            <EmptyState
              icon={Users}
              title="Du hast noch keine Athleten"
              description="Challenges brauchen Teilnehmer. Lade zuerst Athleten ein."
              action={
                <Button asChild>
                  <Link to="/coach/athletes/new">Athleten einladen</Link>
                </Button>
              }
            />
          );
        }
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <StepHeading
                title="Wer macht mit?"
                description="Ausgewählte Athleten sind sofort dabei und bekommen eine Mail."
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  update({ participantIds: allSelected ? [] : available.map((a) => a.id) })
                }
              >
                {allSelected ? "Keine auswählen" : "Alle auswählen"}
              </Button>
            </div>
            <div aria-label="Athleten" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((athlete) => {
                const selected = draft.participantIds.includes(athlete.id);
                return (
                  <ChoiceCard
                    key={athlete.id}
                    role="checkbox"
                    selected={selected}
                    onSelect={() =>
                      update({
                        participantIds: selected
                          ? draft.participantIds.filter((id) => id !== athlete.id)
                          : [...draft.participantIds, athlete.id],
                      })
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="bg-inset flex size-8 items-center justify-center rounded-full text-xs font-semibold"
                      >
                        {initials(athlete.name)}
                      </span>
                      <span className="flex-1 text-sm">{athlete.name}</span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-5 items-center justify-center rounded-md",
                          selected ? "bg-accent text-bg" : "border-border-strong border-[1.5px]",
                        )}
                      >
                        {selected && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                    </span>
                  </ChoiceCard>
                );
              })}
            </div>
          </div>
        );
      }}
    </QueryState>
  );
}

function DetailsStep({ draft, update }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeading
        title="Titel, Preis und Nachricht"
        description="Der Preis ist optional, die Übergabe regelst du selbst."
      />
      <TextField
        label="Titel"
        value={draft.title}
        maxLength={60}
        onChange={(event) => update({ title: event.target.value })}
      />
      <TextField
        label="Preis (optional)"
        placeholder="z. B. Gratis-Stunde, Shaker, Ruhm und Ehre"
        value={draft.prize}
        maxLength={120}
        onChange={(event) => update({ prize: event.target.value })}
      />
      <TextareaField
        label="Nachricht an die Athleten (optional)"
        rows={3}
        value={draft.description}
        maxLength={500}
        onChange={(event) => update({ description: event.target.value })}
      />
    </div>
  );
}

function measureSummary(draft: Draft) {
  const metric = draft.metric!;
  if (metric === "manual") {
    return draft.manualMode === "quantity"
      ? `Freie Vorgabe · Tagesziel ${draft.dailyTarget}`
      : "Freie Vorgabe · abhaken";
  }
  return `${challengeMetricLabels[metric]}${draft.exercise ? ` · ${draft.exercise.name}` : ""}`;
}

function scoringSummary(draft: Draft) {
  const goal = positive(draft.goal);
  if (draft.scoring === "ranking" || goal === null) return challengeScoringLabels[draft.scoring];
  return `${challengeScoringLabels[draft.scoring]} · ${formatScore(draft.metric!, goal)}`;
}

function ReviewStep({ draft, goTo }: StepProps) {
  const rows: [string, string, number][] = [
    ["Metrik", measureSummary(draft), 0],
    ["Wertung", scoringSummary(draft), 1],
    ["Zeitraum", formatPeriod(draft.startDate, draft.endDate), 2],
    ["Teilnehmer", `${draft.participantIds.length} Athleten`, 3],
    ["Titel", draft.title, 4],
    ["Preis", draft.prize.trim() || "–", 4],
  ];
  return (
    <div className="flex flex-col gap-4">
      <StepHeading
        title="Alles bereit?"
        description="Nach dem Start lassen sich nur noch Titel, Nachricht und Preis ändern."
      />
      <dl className="bg-surface divide-border divide-y overflow-hidden rounded-tile">
        {rows.map(([label, value, step]) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <dt className="text-muted w-28 shrink-0 text-sm">{label}</dt>
            <dd className="min-w-0 flex-1 text-sm font-medium">{value}</dd>
            <button
              type="button"
              onClick={() => goTo(step)}
              className="text-accent text-sm"
              aria-label={`${label} ändern`}
            >
              Ändern
            </button>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface StepProps {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  goTo: (step: number) => void;
}

const stepComponents = [
  MetricStep,
  ScoringStep,
  PeriodStep,
  ParticipantsStep,
  DetailsStep,
  ReviewStep,
];

/** Vorschau, wie Athleten die Challenge sehen. */
function Preview({ draft }: { draft: Draft }) {
  const shortDate = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
  return (
    <aside aria-label="Vorschau für Athleten" className="flex flex-col gap-2.5 lg:w-80">
      <span className="text-muted text-xs font-semibold tracking-wider uppercase">
        Vorschau für Athleten
      </span>
      <div className="bg-bg border-border rounded-[24px] border p-3.5">
        <div className="bg-surface flex flex-col gap-2.5 rounded-tile p-3.5">
          <span className="flex gap-1.5">
            <KindBadge kind="coach" />
            {draft.metric && <MetricChip metric={draft.metric} />}
          </span>
          <span className="text-lg font-semibold">
            {draft.title.trim() ||
              (draft.metric ? titleSuggestion[draft.metric] : "") ||
              "Neue Challenge"}
          </span>
          <span className="text-muted text-xs">
            {draft.metric ? `${scoringSummary(draft)} · ` : ""}
            {formatPeriod(draft.startDate, draft.endDate)}
          </span>
          <ChallengeBar kind="coach" ratio={0} label="Vorschau Fortschritt" />
          <span className="text-muted flex justify-between text-xs">
            <span>{draft.participantIds.length} dabei</span>
            <span>startet am {shortDate.format(parseIsoDate(draft.startDate))}</span>
          </span>
          {draft.prize.trim() && (
            <span className="bg-challenge-coach/10 text-challenge-coach flex items-center gap-2 rounded-card px-2.5 py-2 text-xs">
              <Gift aria-hidden="true" className="size-4" /> {draft.prize.trim()}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function NewChallengePage() {
  const navigate = useNavigate();
  const create = useCreateChallenge();
  const today = todayIsoDate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    group: null,
    metric: null,
    exercise: null,
    manualMode: "quantity",
    dailyTarget: "",
    scoring: "ranking",
    goal: "",
    startDate: today,
    endDate: addDays(today, 13),
    participantIds: [],
    title: "",
    description: "",
    prize: "",
  });

  const update = (patch: Partial<Draft>) => {
    setError(null);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const goTo = (target: number) => {
    // Vorwärts nur, wenn alle Schritte davor vollständig sind.
    for (let i = 0; i < target; i += 1) {
      const problem = stepError(i, draft, today);
      if (problem) {
        setStep(i);
        setError(problem);
        return;
      }
    }
    if (target === 4 && !draft.title.trim() && draft.metric) {
      update({ title: titleSuggestion[draft.metric] });
    }
    setError(null);
    setStep(target);
  };

  const submit = async () => {
    try {
      const created = await create.mutateAsync(toRequest(draft));
      toast(
        created.status === "planned"
          ? "Challenge geplant. Deine Athleten wurden benachrichtigt."
          : "Challenge gestartet. Deine Athleten wurden benachrichtigt.",
      );
      void navigate(`/coach/challenges/${created.id}`);
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  };

  const Step = stepComponents[step]!;
  const last = step === STEPS.length - 1;

  return (
    <div className="flex flex-col gap-5">
      <title>Neue Challenge · AthletePT</title>
      <div className="flex flex-col gap-0.5">
        <Link
          to="/coach/challenges"
          className="text-muted inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Challenges
        </Link>
        <h1 className="text-2xl font-medium sm:text-3xl">Neue Challenge</h1>
      </div>
      <ol aria-label="Schritte" className="grid grid-cols-6 gap-2">
        {STEPS.map((name, index) => (
          <li key={name}>
            <button
              type="button"
              aria-current={step === index ? "step" : undefined}
              onClick={() => goTo(index)}
              className="flex w-full flex-col gap-2 text-left"
            >
              <span
                aria-hidden="true"
                className={cn("h-1 rounded-full", index <= step ? "bg-accent" : "bg-border")}
              />
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  step === index ? "font-semibold" : "text-muted",
                )}
              >
                {index + 1}. {name}
              </span>
              <span className="sr-only sm:hidden">
                Schritt {index + 1}: {name}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="bg-inset flex min-w-0 flex-1 flex-col gap-5 rounded-tile p-4 sm:p-6">
          <Step draft={draft} update={update} goTo={goTo} />
          {error && <Alert variant="error">{error}</Alert>}
          <div className="border-border flex justify-end gap-2.5 border-t pt-4">
            {step > 0 && (
              <Button variant="secondary" onClick={() => goTo(step - 1)}>
                Zurück
              </Button>
            )}
            {last ? (
              <Button loading={create.isPending} onClick={() => void submit()}>
                {draft.startDate === today ? "Challenge starten" : "Challenge planen"}
              </Button>
            ) : (
              <Button onClick={() => goTo(step + 1)}>Weiter</Button>
            )}
          </div>
        </div>
        <Preview draft={draft} />
      </div>
    </div>
  );
}
