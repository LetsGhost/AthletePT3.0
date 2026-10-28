import type { ChallengeSummary } from "@athletept/shared";
import { Link } from "react-router";

import { cn } from "@/lib/cn";

import { ChallengeBar, KindBadge, MetricChip } from "./challenge-visuals";
import {
  duelScoreText,
  duelTitle,
  formatCountdown,
  formatPeriod,
  formatScore,
  progressRatio,
  standingText,
} from "./format";

/** Ergebnis-Kennzeichnung einer beendeten Challenge. */
function resultTag(challenge: ChallengeSummary) {
  const me = challenge.me;
  if (challenge.duel) {
    const text = standingText(challenge);
    return {
      label: text === "Gewonnen" ? "Sieg" : text === "Verloren" ? "Niederlage" : text,
      strong: text === "Gewonnen",
    };
  }
  if (challenge.scoring === "ranking") {
    return me?.achieved
      ? { label: "Sieg", strong: true }
      : { label: `Platz ${me?.rank ?? "–"}`, strong: false };
  }
  return me?.achieved
    ? { label: "Geschafft", strong: true }
    : { label: "Nicht geschafft", strong: false };
}

/** Karte einer Challenge in der Übersicht des Athleten. */
export function ChallengeCard({ challenge }: { challenge: ChallengeSummary }) {
  const tag = challenge.status === "finished" ? resultTag(challenge) : null;
  return (
    <Link
      to={`/challenges/${challenge.id}`}
      className="bg-surface hover:bg-inset flex flex-col gap-2.5 rounded-tile p-3.5 transition-colors"
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <KindBadge kind={challenge.kind} />
        <MetricChip metric={challenge.metric} />
        <span className="flex-1" />
        <span
          className={cn(
            "text-[11px] font-semibold",
            challenge.status === "planned" ? "text-accent" : "text-muted",
          )}
        >
          {challenge.status === "finished"
            ? formatPeriod(challenge.startDate, challenge.endDate)
            : formatCountdown(challenge)}
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">
          {challenge.duel ? duelTitle(challenge) : challenge.title}
        </span>
        {challenge.duel && (
          <span className="text-muted text-sm">
            {challenge.title}
            {challenge.exerciseName && ` · ${challenge.exerciseName}`}
          </span>
        )}
        {!challenge.duel && (challenge.description || challenge.prize) && (
          <span className="text-muted line-clamp-2 text-sm">
            {challenge.description}
            {challenge.description && challenge.prize && " "}
            {challenge.prize && `Preis: ${challenge.prize}`}
          </span>
        )}
      </span>
      {challenge.status === "running" && (
        <span className="flex flex-col gap-1.5">
          <ChallengeBar
            kind={challenge.kind}
            ratio={progressRatio(challenge)}
            label={`Fortschritt ${challenge.title}`}
          />
          <span className="flex justify-between gap-2 text-xs">
            <span className="font-semibold">
              {challenge.duel
                ? duelScoreText(challenge)
                : challenge.metric === "manual" && challenge.todayValue === null
                  ? "Heute noch nicht eingetragen"
                  : formatScore(challenge.metric, challenge.me?.score ?? 0)}
            </span>
            <span className="text-muted">{standingText(challenge)}</span>
          </span>
        </span>
      )}
      {challenge.status === "planned" && (
        <span className="text-muted text-xs">
          {challenge.duel
            ? standingText(challenge)
            : `${formatPeriod(challenge.startDate, challenge.endDate)} · ${challenge.participantCount} dabei`}
        </span>
      )}
      {tag && (
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm">
            {challenge.duel
              ? duelScoreText(challenge)
              : formatScore(challenge.metric, challenge.me?.score ?? 0)}
            {challenge.scoring === "ranking" &&
              !challenge.duel &&
              ` · Platz ${challenge.me?.rank ?? "–"} von ${challenge.participantCount}`}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              tag.strong ? "bg-challenge-coach/15 text-challenge-coach" : "bg-inset text-muted",
            )}
          >
            {tag.label}
          </span>
        </span>
      )}
    </Link>
  );
}
