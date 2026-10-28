import {
  challengeMetricLabels,
  challengeScoringLabels,
  type ChallengeStatus,
  type ChallengeSummary,
} from "@athletept/shared";
import { Plus, Trophy } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAthletes } from "@/features/athletes/api";
import { useCoachChallenges, useTeamDuels } from "@/features/challenges/api";
import { ChallengeBar, ChallengeIcon, KindBadge } from "@/features/challenges/challenge-visuals";
import {
  duelScoreText,
  duelStanding,
  duelTitle,
  formatCountdown,
  formatPeriod,
  formatScore,
  measureText,
} from "@/features/challenges/format";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

const tabs: { value: ChallengeStatus; label: string }[] = [
  { value: "running", label: "Läuft" },
  { value: "planned", label: "Geplant" },
  { value: "finished", label: "Beendet" },
];

/** Stand aus Sicht des Coaches: Text und Anteil für den Balken. */
function coachStanding(challenge: ChallengeSummary) {
  const { metric, goalValue } = challenge;
  if (challenge.status === "planned") {
    return { text: `${challenge.participantCount} Athleten angemeldet`, ratio: 0 };
  }
  if (challenge.scoring === "team_goal" && goalValue) {
    return {
      text: `${formatScore(metric, challenge.teamScore)} von ${formatScore(metric, goalValue)}`,
      ratio: challenge.teamScore / goalValue,
    };
  }
  if (challenge.scoring === "goal") {
    return {
      text: `${challenge.achievedCount} von ${challenge.participantCount} am Ziel`,
      ratio: challenge.participantCount ? challenge.achievedCount / challenge.participantCount : 0,
    };
  }
  const leader = challenge.leader;
  if (!leader || leader.score === 0) return { text: "Noch keine Wertung", ratio: 0 };
  return {
    text: `${challenge.status === "finished" ? "Sieger" : "Vorn"}: ${leader.name} · ${formatScore(metric, leader.score)}`,
    ratio: 1,
  };
}

function ChallengeRow({ challenge }: { challenge: ChallengeSummary }) {
  const standing = coachStanding(challenge);
  return (
    <Link
      to={`/coach/challenges/${challenge.id}`}
      className="hover:bg-inset grid grid-cols-1 gap-3 px-4 py-3.5 transition-colors md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.6fr)] md:items-center md:gap-4"
    >
      <span className="flex min-w-0 items-center gap-3">
        <ChallengeIcon kind={challenge.kind} metric={challenge.metric} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{challenge.title}</span>
          <span className="text-muted truncate text-xs">
            {measureText(challenge, challengeMetricLabels[challenge.metric])} ·{" "}
            {challenge.participantCount} Athleten
          </span>
        </span>
      </span>
      <span className="text-sm">{challengeScoringLabels[challenge.scoring]}</span>
      <span className="flex flex-col">
        <span className="text-sm">{formatPeriod(challenge.startDate, challenge.endDate)}</span>
        <span
          className={cn("text-xs", challenge.status === "planned" ? "text-accent" : "text-muted")}
        >
          {challenge.endedEarly ? "vorzeitig beendet" : formatCountdown(challenge)}
        </span>
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="text-xs">{standing.text}</span>
        {challenge.status !== "planned" && (
          <ChallengeBar
            kind={challenge.kind}
            ratio={standing.ratio}
            label={`Stand ${challenge.title}`}
          />
        )}
      </span>
    </Link>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-surface flex flex-col gap-1 rounded-tile p-4">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="flex flex-col">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-muted text-xs">{note}</span>
      </dd>
    </div>
  );
}

/** Duelle der eigenen Athleten, auch gegen Athleten anderer Coaches. */
function TeamDuels() {
  const duels = useTeamDuels();
  return (
    <section aria-labelledby="team-duels" className="mt-8 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="team-duels" className="text-lg font-semibold">
          Deine Athleten in Duellen
        </h2>
        {duels.data && (
          <span className="text-muted text-sm">
            {duels.data.items.filter((d) => d.challenge.status === "running").length} laufend ·{" "}
            {duels.data.items.filter((d) => d.challenge.duel?.state === "pending").length} offen
          </span>
        )}
      </div>
      <QueryState query={duels} loading={<SkeletonList rows={2} className="h-16" />}>
        {({ items }) =>
          items.length === 0 ? (
            <p className="bg-surface text-muted rounded-tile p-5 text-center text-sm">
              Deine Athleten haben gerade keine Duelle.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {items.map(({ athleteId, athleteName, challenge }) => (
                <li
                  key={`${athleteId}-${challenge.id}`}
                  className="bg-surface flex items-center gap-3 rounded-tile p-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="bg-inset flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  >
                    {initials(athleteName)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Link to={`/coach/athletes/${athleteId}`} className="text-sm font-semibold">
                      {athleteName}
                    </Link>
                    <span className="text-muted truncate text-xs">
                      {duelTitle(challenge).replace("Duell vs.", "gegen")} · {challenge.title}
                      {challenge.status !== "finished" && ` · ${formatCountdown(challenge)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <KindBadge kind="duel" />
                    <span className="text-xs font-semibold">
                      {challenge.status === "planned"
                        ? duelStanding(challenge)
                        : `${duelScoreText(challenge)} · ${duelStanding(challenge)}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </section>
  );
}

export default function CoachChallengesPage() {
  const challenges = useCoachChallenges();
  const athletes = useAthletes();
  const [tab, setTab] = useState<ChallengeStatus>("running");

  const newButton = (
    <Button asChild>
      <Link to="/coach/challenges/new">
        <Plus aria-hidden="true" className="size-4" /> Challenge anlegen
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Challenges"
        description="Motiviere dein Team mit eigenen Challenges."
        actions={newButton}
      />
      <QueryState query={challenges} loading={<SkeletonList rows={4} className="h-16" />}>
        {({ items }) => {
          if (items.length === 0) {
            return (
              <div className="bg-surface rounded-tile">
                <EmptyState
                  icon={Trophy}
                  title="Noch keine eigene Challenge"
                  description="Starte eine Challenge für dein Team, mit Trainingsdaten oder einer freien Vorgabe wie „100 Klimmzüge am Tag“."
                  action={newButton}
                />
              </div>
            );
          }
          const running = items.filter((c) => c.status === "running");
          const planned = items.filter((c) => c.status === "planned");
          const activeAthletes =
            athletes.data?.items.filter((a) => a.status !== "disabled").length ?? null;
          const participantTotal = running.reduce((sum, c) => sum + c.participantCount, 0);
          const visible = items.filter((c) => c.status === tab);
          return (
            <div className="flex flex-col gap-6">
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Kpi
                  label="Laufende Challenges"
                  value={String(running.length)}
                  note={`${planned.length} geplant`}
                />
                <Kpi
                  label="Teilnahmen"
                  value={String(participantTotal)}
                  note={
                    activeAthletes === null
                      ? "in laufenden Challenges"
                      : `bei ${activeAthletes} aktiven Athleten`
                  }
                />
                <Kpi
                  label="Abgeschlossen"
                  value={String(items.length - running.length - planned.length)}
                  note="bisher"
                />
              </dl>
              <section aria-labelledby="own-challenges" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="own-challenges" className="text-lg font-semibold">
                    Deine Challenges
                  </h2>
                  <SegmentedControl
                    label="Status"
                    value={tab}
                    onChange={setTab}
                    options={tabs.map((t) => ({
                      value: t.value,
                      label: `${t.label} ${items.filter((c) => c.status === t.value).length}`,
                    }))}
                  />
                </div>
                <div className="bg-surface overflow-hidden rounded-tile">
                  <div className="border-border text-muted hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.6fr)] gap-4 border-b px-4 py-3 text-xs md:grid">
                    <span>Challenge</span>
                    <span>Wertung</span>
                    <span>Zeitraum</span>
                    <span>Stand</span>
                  </div>
                  {visible.length === 0 ? (
                    <p className="text-muted p-7 text-center text-sm">Hier ist gerade nichts.</p>
                  ) : (
                    <ul className="divide-border divide-y">
                      {visible.map((challenge) => (
                        <li key={challenge.id}>
                          <ChallengeRow challenge={challenge} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          );
        }}
      </QueryState>
      <TeamDuels />
    </>
  );
}
