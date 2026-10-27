import { Trophy } from "lucide-react";
import { Link } from "react-router";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { cn } from "@/lib/cn";

import { useAthleteChallenges } from "./api";
import { ChallengeBar, KindBadge } from "./challenge-visuals";
import { kindTone } from "./tones";
import { formatCountdown, formatScore, progressRatio, standingText } from "./format";

/** Coach-Ansicht eines Athleten: Challenges, in denen er dabei ist. */
export function AthleteChallengesCard({ athleteId }: { athleteId: string }) {
  const challenges = useAthleteChallenges(athleteId);
  return (
    <Card>
      <CardHeader
        title="Challenges"
        icon={Trophy}
        iconClassName="text-challenge-coach"
        action={
          <Link to="/coach/challenges/new" className="text-accent text-sm">
            Neue Challenge
          </Link>
        }
      />
      <CardBody>
        <QueryState query={challenges} loading={<SkeletonList rows={2} className="h-16" />}>
          {({ items }) => {
            const current = items.filter((c) => c.status !== "finished");
            const finished = items.filter((c) => c.status === "finished").slice(0, 5);
            if (items.length === 0) {
              return <p className="text-muted text-sm">Macht gerade bei keiner Challenge mit.</p>;
            }
            return (
              <div className="flex flex-col gap-3">
                {current.map((challenge) => (
                  <Link
                    key={challenge.id}
                    to={`/coach/challenges/${challenge.id}`}
                    className="bg-inset hover:bg-bg flex flex-col gap-2 rounded-card p-3 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <KindBadge kind={challenge.kind} />
                      <span className="text-muted flex-1 truncate text-xs">
                        {formatCountdown(challenge)}
                      </span>
                    </span>
                    <span className="font-medium">{challenge.title}</span>
                    {challenge.status === "running" && (
                      <>
                        <span className="flex justify-between gap-2 text-xs">
                          <span>{formatScore(challenge.metric, challenge.me?.score ?? 0)}</span>
                          <span className={cn("font-semibold", kindTone[challenge.kind].text)}>
                            {standingText(challenge)}
                          </span>
                        </span>
                        <ChallengeBar
                          kind={challenge.kind}
                          ratio={progressRatio(challenge)}
                          label={`Fortschritt ${challenge.title}`}
                        />
                      </>
                    )}
                  </Link>
                ))}
                {finished.length > 0 && (
                  <ul className="divide-border divide-y text-sm">
                    {finished.map((challenge) => (
                      <li key={challenge.id} className="flex justify-between gap-3 py-2">
                        <Link to={`/coach/challenges/${challenge.id}`} className="truncate">
                          {challenge.title}
                        </Link>
                        <span className="text-muted shrink-0">{standingText(challenge)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }}
        </QueryState>
      </CardBody>
    </Card>
  );
}
