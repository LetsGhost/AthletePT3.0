import {
  addDays,
  badgeTierLabels,
  badgeTiers,
  challengeMetricGroup,
  challengeMetricLabels,
  createSystemTemplateRequestSchema,
  systemMetrics,
  systemRhythmLabels,
  systemRhythms,
  todayIsoDate,
  type SystemMetric,
  type SystemRhythm,
} from "@athletept/shared";
import { ArrowLeft, Info, Medal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { ChallengeBar, KindBadge, MetricChip } from "@/features/challenges/challenge-visuals";
import { formatPeriod } from "@/features/challenges/format";
import { metricGroupIcon, tierTone } from "@/features/challenges/tones";
import { useCreateSystemTemplate } from "@/features/system-challenges/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/http";

/** Einheit und Vorschlag je Metrik. Volumen wird in Tonnen eingegeben und in kg gespeichert. */
const metricInfo: Record<SystemMetric, { unit: string; defaults: string[]; factor: number }> = {
  workouts: { unit: "Trainings", defaults: ["8", "12", "16"], factor: 1 },
  training_days: { unit: "Tage", defaults: ["8", "12", "16"], factor: 1 },
  volume: { unit: "t", defaults: ["10", "20", "30"], factor: 1000 },
  sets: { unit: "Sätze", defaults: ["60", "120", "200"], factor: 1 },
};

const rhythmHint: Record<SystemRhythm, string> = {
  weekly: "Startet jeden Montag automatisch eine neue Runde.",
  monthly: "Startet am 1. jedes Monats automatisch eine neue Runde.",
  once: "Ein Event mit festem Zeitraum. Athleten können vorab beitreten.",
};

function Choice({
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
        "flex items-center gap-2.5 rounded-tile border px-3.5 py-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/20"
          : "bg-surface hover:border-border-strong border-transparent",
      )}
    >
      {children}
    </button>
  );
}

export default function NewSystemChallengePage() {
  const navigate = useNavigate();
  const create = useCreateSystemTemplate();
  const today = todayIsoDate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState<SystemMetric>("workouts");
  const [tiers, setTiers] = useState(metricInfo.workouts.defaults);
  const [rhythm, setRhythm] = useState<SystemRhythm>("monthly");
  const [startDate, setStartDate] = useState(addDays(today, 7));
  const [endDate, setEndDate] = useState(addDays(today, 36));
  const [error, setError] = useState<string | null>(null);

  const info = metricInfo[metric];
  const pickMetric = (next: SystemMetric) => {
    setMetric(next);
    setTiers(metricInfo[next].defaults);
  };

  const submit = async (status: "draft" | "active") => {
    setError(null);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      metric,
      tiers: tiers.map((t) => Number(t.replace(",", ".")) * info.factor),
      rhythm,
      startDate: rhythm === "once" ? startDate : null,
      endDate: rhythm === "once" ? endDate : null,
      status,
    };
    const parsed = createSystemTemplateRequestSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    try {
      await create.mutateAsync(body);
      toast(status === "active" ? "Vorlage veröffentlicht." : "Entwurf gespeichert.");
      void navigate("/admin/system-challenges");
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  };

  const period = rhythm === "once" ? formatPeriod(startDate, endDate) : systemRhythmLabels[rhythm];

  return (
    <div className="flex flex-col gap-5">
      <title>Neue Vorlage · AthletePT</title>
      <div className="flex flex-col gap-0.5">
        <Link
          to="/admin/system-challenges"
          className="text-muted inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> System-Challenges
        </Link>
        <h1 className="text-2xl font-medium sm:text-3xl">Neue Vorlage</h1>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="bg-inset flex flex-col gap-4 rounded-tile p-4 sm:p-5">
            <h2 className="font-semibold">Grunddaten</h2>
            <TextField
              label="Name"
              value={title}
              maxLength={60}
              placeholder="z. B. Monats-Konstanz"
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextareaField
              label="Beschreibung (optional)"
              rows={2}
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div role="radiogroup" aria-label="Metrik" className="grid gap-2 sm:grid-cols-2">
              {systemMetrics.map((m) => {
                const Icon = metricGroupIcon[challengeMetricGroup[m]];
                return (
                  <Choice key={m} selected={metric === m} onSelect={() => pickMetric(m)}>
                    <Icon aria-hidden="true" className="text-challenge-system size-5" />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{challengeMetricLabels[m]}</span>
                      <span className="text-muted text-xs">in {metricInfo[m].unit}</span>
                    </span>
                  </Choice>
                );
              })}
            </div>
            <p className="text-muted text-xs">
              Freie Vorgaben gibt es global nicht, System-Challenges werten nur erledigte Trainings.
            </p>
          </section>

          <section className="bg-inset flex flex-col gap-4 rounded-tile p-4 sm:p-5">
            <h2 className="font-semibold">Ziele &amp; Abzeichen-Stufen</h2>
            <div className="grid grid-cols-3 gap-3">
              {badgeTiers.map((tier, index) => (
                <TextField
                  key={tier}
                  label={badgeTierLabels[tier]}
                  inputMode="decimal"
                  value={tiers[index]}
                  onChange={(event) =>
                    setTiers(tiers.map((t, i) => (i === index ? event.target.value : t)))
                  }
                  trailing={<span className="text-muted pr-3 text-xs">{info.unit}</span>}
                />
              ))}
            </div>
          </section>

          <section className="bg-inset flex flex-col gap-4 rounded-tile p-4 sm:p-5">
            <h2 className="font-semibold">Rhythmus</h2>
            <div role="radiogroup" aria-label="Rhythmus" className="flex flex-wrap gap-2">
              {systemRhythms.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={rhythm === r}
                  onClick={() => setRhythm(r)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-sm",
                    rhythm === r ? "bg-text text-bg" : "border-border-strong border",
                  )}
                >
                  {systemRhythmLabels[r]}
                </button>
              ))}
            </div>
            {rhythm === "once" && (
              <div className="grid max-w-md grid-cols-2 gap-3">
                <TextField
                  label="Start"
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
                <TextField
                  label="Ende"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            )}
            <p className="text-muted flex gap-2 text-xs">
              <Info aria-hidden="true" className="size-4 shrink-0" />
              {rhythmHint[rhythm]}
            </p>
          </section>

          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button
              variant="secondary"
              loading={create.isPending}
              onClick={() => void submit("draft")}
            >
              Als Entwurf speichern
            </Button>
            <Button loading={create.isPending} onClick={() => void submit("active")}>
              Veröffentlichen
            </Button>
          </div>
        </div>

        <aside aria-label="Vorschau" className="flex flex-col gap-2.5 lg:w-80">
          <span className="text-muted text-xs font-semibold tracking-wider uppercase">
            Vorschau
          </span>
          <div className="bg-surface flex flex-col gap-2.5 rounded-tile p-3.5">
            <span className="flex gap-1.5">
              <KindBadge kind="system" />
              <MetricChip metric={metric} />
            </span>
            <span className="text-lg font-semibold">{title.trim() || "Neue System-Challenge"}</span>
            <span className="text-muted text-xs">{period} · Opt-in mit Spitzname</span>
            <ChallengeBar kind="system" ratio={0} label="Vorschau Fortschritt" />
            <span className="bg-primary text-on-primary flex h-10 items-center justify-center rounded-card text-sm font-semibold">
              Beitreten
            </span>
          </div>
          <ul className="bg-surface grid grid-cols-3 gap-2 rounded-tile p-3">
            {badgeTiers.map((tier, index) => (
              <li key={tier} className="flex flex-col items-center gap-1 text-center">
                <Medal aria-hidden="true" className={cn("size-6", tierTone[tier])} />
                <span className="text-xs">
                  {tiers[index] || "–"} {info.unit}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
