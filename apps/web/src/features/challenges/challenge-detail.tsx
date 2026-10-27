import {
  challengeMetricLabels,
  challengeScoringLabels,
  type ChallengeDetail,
} from "@athletept/shared";
import { CalendarDays, Clock, Gift, Info, Medal, Users } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

import { KindBadge, MetricChip, Standings } from "./challenge-visuals";
import { formatCountdown, formatPeriod, formatScore, measureText } from "./format";

/** Kopf: Art, Metrik, Titel, Beschreibung, Zeitraum, Countdown, Teilnehmer. */
export function ChallengeHero({ challenge }: { challenge: ChallengeDetail }) {
  return (
    <section
      className={cn(
        "bg-surface flex flex-col gap-3 rounded-tile border p-4",
        challenge.status === "planned" ? "border-primary" : "border-transparent",
      )}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <KindBadge kind={challenge.kind} />
        <MetricChip metric={challenge.metric} />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold">{challenge.title}</h1>
        <p className="text-muted text-sm">
          {measureText(challenge, challengeMetricLabels[challenge.metric])} ·{" "}
          {challengeScoringLabels[challenge.scoring]}
          {challenge.goalValue !== null &&
            ` · Ziel ${formatScore(challenge.metric, challenge.goalValue)}`}
        </p>
        {challenge.description && (
          <p className="text-muted text-sm leading-relaxed">„{challenge.description}“</p>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="text-muted size-4" />
          {formatPeriod(challenge.startDate, challenge.endDate)}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-semibold",
            challenge.status === "planned" && "text-accent",
          )}
        >
          <Clock aria-hidden="true" className="text-muted size-4" />
          {challenge.endedEarly ? "vorzeitig beendet" : formatCountdown(challenge)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users aria-hidden="true" className="text-muted size-4" />
          {challenge.participantCount} dabei
        </span>
      </p>
    </section>
  );
}

export function ChallengePrize({ challenge }: { challenge: ChallengeDetail }) {
  if (!challenge.prize) return null;
  const forWhom =
    challenge.scoring === "ranking"
      ? "für Platz 1"
      : challenge.scoring === "team_goal"
        ? "fürs Team"
        : "für alle, die es schaffen";
  return (
    <section className="border-challenge-coach/30 bg-challenge-coach/10 flex items-center gap-3 rounded-tile border px-3.5 py-3">
      <span className="bg-challenge-coach/15 flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Gift aria-hidden="true" className="text-challenge-coach size-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-muted text-xs">
          Preis{challenge.ownerName ? ` von ${challenge.ownerName}` : ""} {forWhom}
        </span>
        <span className="font-semibold">{challenge.prize}</span>
      </span>
    </section>
  );
}

/** Regeln in Worten, damit klar ist, was zählt. */
function rules(challenge: ChallengeDetail) {
  const exercise = challenge.exerciseName ? ` bei ${challenge.exerciseName}` : "";
  const list: string[] = [];
  switch (challenge.metric) {
    case "workouts":
      list.push("Zählt: erledigte Trainings im Zeitraum.");
      break;
    case "training_days":
      list.push("Zählt: Tage mit mindestens einem erledigten Training.");
      break;
    case "volume":
      list.push(`Zählt: bewegte kg aller Arbeitssätze${exercise} aus erledigten Trainings.`);
      list.push("Aufwärmsätze zählen nicht.");
      break;
    case "sets":
      list.push(`Zählt: erledigte Arbeitssätze${exercise}.`);
      break;
    case "e1rm":
      list.push(`Zählt: dein bestes geschätztes Maximum (e1RM)${exercise} im Zeitraum.`);
      break;
    case "manual":
      list.push(
        challenge.manualMode === "quantity" && challenge.dailyTarget
          ? `Zählt: Tage, an denen du ${formatNumber(challenge.dailyTarget)} erreichst. Du trägst selbst ein, nur für heute.`
          : "Zählt: Tage, an denen du abhakst. Abhaken geht nur für heute.",
      );
      break;
  }
  if (challenge.metric !== "manual") {
    list.push("Nachgetragene Trainings zählen, wenn ihr Datum im Zeitraum liegt.");
  }
  if (challenge.scoring === "ranking") {
    list.push("Gleichstand: Wer den Wert zuerst erreicht hat, steht vorn.");
  } else if (challenge.scoring === "team_goal") {
    list.push("Alle sammeln gemeinsam, jeder Beitrag zählt fürs Team-Ziel.");
  } else {
    list.push("Jeder, der das Ziel erreicht, hat es geschafft.");
  }
  return list;
}

export function ChallengeRules({ challenge }: { challenge: ChallengeDetail }) {
  return (
    <section className="bg-inset flex flex-col gap-2.5 rounded-tile p-3.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Info aria-hidden="true" className="text-accent size-4" /> So wird gewertet
      </h2>
      <ul className="flex flex-col gap-1">
        {rules(challenge).map((rule) => (
          <li key={rule} className="text-muted flex gap-2 text-sm leading-relaxed">
            <span aria-hidden="true" className="text-accent">
              •
            </span>
            {rule}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChallengeStandings({ challenge }: { challenge: ChallengeDetail }) {
  if (challenge.status === "planned" || challenge.standings.length === 0) return null;
  return (
    <section aria-labelledby="challenge-standings" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-0.5">
        <h2 id="challenge-standings" className="font-semibold">
          {challenge.scoring === "ranking" ? "Rangliste" : "Teilnehmer"}
        </h2>
        {challenge.scoring === "team_goal" && challenge.goalValue !== null && (
          <span className="text-muted text-xs">
            Team: {formatScore(challenge.metric, challenge.teamScore)} von{" "}
            {formatScore(challenge.metric, challenge.goalValue)}
          </span>
        )}
        {challenge.scoring === "goal" && (
          <span className="text-muted text-xs">
            {challenge.achievedCount} von {challenge.participantCount} am Ziel
          </span>
        )}
      </div>
      <Standings standings={challenge.standings} metric={challenge.metric} />
    </section>
  );
}

/** Ergebnis nach dem Ende aus Sicht des Athleten. */
export function ChallengeResult({ challenge }: { challenge: ChallengeDetail }) {
  const me = challenge.me;
  if (challenge.status !== "finished" || !me) return null;
  const won = me.achieved === true;
  const title =
    challenge.scoring === "ranking"
      ? won
        ? "Gewonnen!"
        : `Platz ${me.rank} von ${challenge.participantCount}`
      : won
        ? challenge.scoring === "team_goal"
          ? "Team-Ziel erreicht!"
          : "Ziel erreicht!"
        : "Knapp daneben";
  const text = won
    ? challenge.prize
      ? `Dein Preis: ${challenge.prize}. ${challenge.ownerName ?? "Dein Coach"} meldet sich bei dir.`
      : "Stark durchgezogen."
    : "Nächstes Mal klappt's. Jedes Training hat gezählt.";
  return (
    <section
      className={cn(
        "flex items-center gap-3.5 rounded-tile border p-4",
        won ? "border-challenge-coach/40 bg-challenge-coach/10" : "bg-surface border-transparent",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-2xl",
          won ? "bg-challenge-coach/20" : "bg-inset",
        )}
      >
        <Medal
          aria-hidden="true"
          className={cn("size-6", won ? "text-challenge-coach" : "text-muted")}
        />
      </span>
      <span className="flex flex-col">
        <span className="text-lg font-semibold">{title}</span>
        <span className="text-muted text-sm">{text}</span>
      </span>
    </section>
  );
}
