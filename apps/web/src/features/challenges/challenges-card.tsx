import { ChevronRight, Swords, Trophy } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/ui/query-state";
import { cn } from "@/lib/cn";

import { useMyChallenges } from "./api";
import { ChallengeBar, ChallengeIcon } from "./challenge-visuals";
import { kindTone } from "./tones";
import { duelScoreText, duelTitle, formatScore, progressRatio, standingText } from "./format";

/** Karte „Challenges“ auf der Fortschritt-Seite: laufende Challenges kompakt. */
function InvitationBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      to="/challenges"
      className="bg-challenge-duel/15 text-challenge-duel inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
    >
      <Swords aria-hidden="true" className="size-3" />
      {count} {count === 1 ? "Einladung" : "Einladungen"}
    </Link>
  );
}

export function MyChallengesCard() {
  const challenges = useMyChallenges();
  const invitationCount =
    challenges.data?.items.filter(
      (c) => c.duel?.state === "pending" && c.duel.iAmChallenger === false,
    ).length ?? 0;

  return (
    <section
      aria-labelledby="challenges-card"
      className="bg-surface rounded-tile px-4 pt-3.5 pb-1.5"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5">
        <span className="flex items-center gap-2">
          <h2 id="challenges-card" className="font-semibold">
            Challenges
          </h2>
          <InvitationBadge count={invitationCount} />
        </span>
        <Link
          to="/challenges"
          className="text-accent inline-flex min-h-8 items-center gap-0.5 text-sm font-medium"
        >
          Alle <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <QueryState query={challenges} loading={<div className="skeleton mb-2 h-28 rounded-card" />}>
        {({ items }) => {
          const running = items.filter((c) => c.status === "running").slice(0, 3);
          if (running.length === 0) {
            const planned = items.find((c) => c.status === "planned");
            return (
              <div className="flex flex-col items-center gap-2.5 px-2 pt-3 pb-5 text-center">
                <span className="bg-accent/15 flex size-12 items-center justify-center rounded-2xl">
                  <Trophy aria-hidden="true" className="text-accent size-6" />
                </span>
                <p className="font-semibold">
                  {planned ? "Bald geht's los" : "Gerade läuft keine Challenge"}
                </p>
                <p className="text-muted max-w-xs text-sm">
                  {planned
                    ? `„${planned.title}“ startet bald. Du bist schon dabei.`
                    : "Fordere jemanden zum Duell heraus oder warte auf eine Challenge deines Coaches."}
                </p>
                <Button asChild variant="secondary" size="sm">
                  <Link to={items.length > 0 ? "/challenges" : "/challenges/duell"}>
                    {items.length > 0 ? "Challenges ansehen" : "Duell starten"}
                  </Link>
                </Button>
              </div>
            );
          }
          return (
            <ul>
              {running.map((challenge, index) => (
                <li key={challenge.id}>
                  <Link
                    to={`/challenges/${challenge.id}`}
                    className={cn(
                      "hover:bg-inset -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors",
                      index > 0 && "border-border rounded-t-none border-t",
                    )}
                  >
                    <ChallengeIcon kind={challenge.kind} metric={challenge.metric} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="flex justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {challenge.duel ? duelTitle(challenge) : challenge.title}
                        </span>
                        <span className="text-muted shrink-0 text-xs">
                          {challenge.duel
                            ? duelScoreText(challenge)
                            : challenge.metric === "manual" && challenge.todayValue === null
                              ? "heute offen"
                              : formatScore(challenge.metric, challenge.me?.score ?? 0)}
                        </span>
                      </span>
                      <ChallengeBar
                        kind={challenge.kind}
                        ratio={progressRatio(challenge)}
                        label={`Fortschritt ${challenge.title}`}
                      />
                      <span className={cn("text-xs font-medium", kindTone[challenge.kind].text)}>
                        {standingText(challenge)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryState>
    </section>
  );
}
