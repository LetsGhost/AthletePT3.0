import type { ChallengeDetail } from "@athletept/shared";
import { ArrowLeft, Trophy } from "lucide-react";
import { Link, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useMyChallenge } from "@/features/challenges/api";
import {
  ChallengeHero,
  ChallengePrize,
  ChallengeResult,
  ChallengeRules,
  ChallengeStandings,
} from "@/features/challenges/challenge-detail";
import { ChallengeRing } from "@/features/challenges/challenge-visuals";
import { kindTone } from "@/features/challenges/tones";
import { formatScore, progressRatio, scoreParts } from "@/features/challenges/format";
import { ManualEntry } from "@/features/challenges/manual-entry";
import { ApiError } from "@/lib/http";
import { cn } from "@/lib/cn";

/** Hinweis unter dem Platz: Abstand zum Nächsten bzw. was zum Ziel fehlt. */
function standingHint(challenge: ChallengeDetail) {
  const me = challenge.me!;
  const { metric, goalValue } = challenge;
  if (challenge.scoring === "goal" && goalValue !== null) {
    return me.score >= goalValue
      ? "Ziel erreicht"
      : `Noch ${formatScore(metric, goalValue - me.score)} bis zum Ziel`;
  }
  if (challenge.scoring === "team_goal" && goalValue !== null) {
    return `Team: ${formatScore(metric, challenge.teamScore)} von ${formatScore(metric, goalValue)}`;
  }
  const index = challenge.standings.findIndex((s) => s.isMe);
  const ahead = challenge.standings[index - 1];
  if (!ahead) return me.score > 0 ? "Du führst" : "Noch ist alles offen";
  return `${formatScore(metric, ahead.score - me.score)} hinter ${ahead.name}`;
}

function MyStanding({ challenge }: { challenge: ChallengeDetail }) {
  const me = challenge.me;
  if (!me || challenge.status === "planned") return null;
  const big = scoreParts(challenge.metric, me.score);
  const title =
    challenge.scoring === "ranking"
      ? `Platz ${me.rank}`
      : challenge.scoring === "team_goal"
        ? "Dein Beitrag"
        : me.achieved
          ? "Geschafft"
          : "Unterwegs";
  return (
    <section className="bg-surface flex items-center gap-4 rounded-tile p-4">
      <ChallengeRing
        kind={challenge.kind}
        ratio={progressRatio(challenge)}
        label={`${big.value} ${big.unit}`}
      >
        <span className="text-[22px] leading-none font-bold">{big.value}</span>
        <span className="text-muted text-[11px]">{big.unit}</span>
      </ChallengeRing>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-muted text-xs">Dein Stand</span>
        <span className="text-xl font-semibold">{title}</span>
        <span className={cn("text-xs font-medium", kindTone[challenge.kind].text)}>
          {standingHint(challenge)}
        </span>
      </span>
    </section>
  );
}

export default function AthleteChallengePage() {
  const { challengeId = "" } = useParams();
  const challenge = useMyChallenge(challengeId);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3.5">
      <Link to="/challenges" className="text-muted inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft aria-hidden="true" className="size-4" /> Challenges
      </Link>
      {challenge.isError &&
      challenge.error instanceof ApiError &&
      challenge.error.status === 404 ? (
        <div className="bg-surface rounded-tile">
          <title>Challenge nicht gefunden · AthletePT</title>
          <EmptyState
            icon={Trophy}
            title="Challenge nicht gefunden"
            description="Diese Challenge gibt es nicht mehr oder du bist nicht dabei."
            action={
              <Button asChild>
                <Link to="/challenges">Zur Übersicht</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <QueryState query={challenge} loading={<SkeletonList rows={3} className="h-36" />}>
          {(data) => (
            <>
              <title>{`${data.title} · AthletePT`}</title>
              <ChallengeHero challenge={data} />
              <ChallengeResult challenge={data} />
              {data.metric === "manual" && <ManualEntry challenge={data} />}
              <MyStanding challenge={data} />
              <ChallengePrize challenge={data} />
              <ChallengeStandings challenge={data} />
              <ChallengeRules challenge={data} />
              {data.ownerName && (
                <p className="text-muted text-center text-xs">
                  {data.ownerName} hat dich angemeldet, du bist automatisch dabei.
                </p>
              )}
            </>
          )}
        </QueryState>
      )}
    </div>
  );
}
