import type { ChallengeSummary } from "@athletept/shared";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toast } from "@/components/ui/toast-store";
import { useDeclineDuel, useDiscoverChallenges, useMyChallenges } from "@/features/challenges/api";
import { ChallengeCard } from "@/features/challenges/challenge-card";
import { StartDuelLink } from "@/features/challenges/duel-detail";
import { formatCountdown } from "@/features/challenges/format";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { errorMessage } from "@/lib/http";

type Tab = "active" | "discover" | "finished";

const tabs: { value: Tab; label: string; empty: string }[] = [
  { value: "active", label: "Aktiv", empty: "Gerade läuft keine Challenge." },
  { value: "discover", label: "Entdecken", empty: "Gerade gibt es keine neuen System-Challenges." },
  { value: "finished", label: "Abgeschlossen", empty: "Noch keine Challenge abgeschlossen." },
];

/** Aktiv umfasst laufende und bald startende (eigene Einladungen, geplante Challenges). */
const tabOf = (c: ChallengeSummary): Tab => (c.status === "finished" ? "finished" : "active");

const isIncoming = (c: ChallengeSummary) =>
  c.duel?.state === "pending" && c.duel.iAmChallenger === false;

/** Eingegangene Duell-Einladung oben auf der Seite. */
function Invitation({ challenge }: { challenge: ChallengeSummary }) {
  const navigate = useNavigate();
  const decline = useDeclineDuel();
  const name = challenge.duel?.opponentName ?? "Jemand";
  return (
    <section
      aria-label={`Einladung von ${name}`}
      className="border-challenge-duel/40 bg-surface flex flex-col gap-3 rounded-tile border p-3.5"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-challenge-duel/30 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        >
          {initials(name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm">
            <span className="font-semibold">{name}</span> fordert dich heraus
          </span>
          <span className="text-muted text-xs">
            {challenge.title} · {challenge.duel!.durationDays / 7}{" "}
            {challenge.duel!.durationDays === 7 ? "Woche" : "Wochen"} · {formatCountdown(challenge)}
          </span>
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          loading={decline.isPending}
          onClick={() =>
            decline.mutate(challenge.id, {
              onSuccess: () => toast("Einladung abgelehnt."),
              onError: (error) => toast(errorMessage(error), "error"),
            })
          }
        >
          Ablehnen
        </Button>
        <Button
          size="sm"
          className="bg-challenge-duel text-bg hover:bg-challenge-duel flex-[1.3] hover:opacity-90"
          onClick={() => void navigate(`/challenges/${challenge.id}`)}
        >
          Ansehen
        </Button>
      </div>
    </section>
  );
}

export default function AthleteChallengesPage() {
  const challenges = useMyChallenges();
  const discover = useDiscoverChallenges();
  const [tab, setTab] = useState<Tab>("active");

  return (
    <>
      <PageHeader
        title="Challenges"
        description="Allein, im Duell oder mit dem Team."
        actions={<StartDuelLink />}
      />
      <QueryState query={challenges} loading={<SkeletonList rows={3} className="h-36" />}>
        {({ items }) => {
          const invitations = items.filter(isIncoming);
          const listed = items.filter((c) => !isIncoming(c));
          const discoverable = discover.data?.items ?? [];
          if (items.length === 0 && discoverable.length === 0) {
            return (
              <div className="bg-surface rounded-tile">
                <EmptyState
                  icon={Trophy}
                  title="Noch nichts los hier"
                  description="Aktuell läuft keine Challenge für dich. Fordere jemanden heraus oder warte auf eine Challenge deines Coaches."
                  action={
                    <Button asChild>
                      <Link to="/challenges/duell">Duell starten</Link>
                    </Button>
                  }
                />
              </div>
            );
          }
          const visible =
            tab === "discover" ? discoverable : listed.filter((c) => tabOf(c) === tab);
          const current = tabs.find((t) => t.value === tab)!;
          return (
            <div className="flex flex-col gap-3.5">
              {invitations.map((challenge) => (
                <Invitation key={challenge.id} challenge={challenge} />
              ))}
              <SegmentedControl
                label="Challenges"
                value={tab}
                onChange={setTab}
                className="sm:self-start"
                options={tabs.map((t) => {
                  const count =
                    t.value === "discover"
                      ? discoverable.length
                      : listed.filter((c) => tabOf(c) === t.value).length;
                  return {
                    value: t.value,
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        {t.label}
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-[11px] font-semibold",
                            tab === t.value ? "bg-primary text-on-primary" : "bg-inset",
                          )}
                        >
                          {count}
                        </span>
                      </span>
                    ),
                  };
                })}
              />
              {visible.length === 0 ? (
                <p className="border-border text-muted rounded-tile border-2 border-dashed p-6 text-center text-sm">
                  {current.empty}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {visible.map((challenge) => (
                    <li key={challenge.id}>
                      <ChallengeCard challenge={challenge} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
