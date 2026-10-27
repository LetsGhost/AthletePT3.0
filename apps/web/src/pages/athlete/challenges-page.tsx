import type { ChallengeStatus } from "@athletept/shared";
import { Trophy } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMyChallenges } from "@/features/challenges/api";
import { ChallengeCard } from "@/features/challenges/challenge-card";
import { cn } from "@/lib/cn";

const tabs: { value: ChallengeStatus; label: string; empty: string }[] = [
  { value: "running", label: "Aktiv", empty: "Gerade läuft keine Challenge." },
  { value: "planned", label: "Geplant", empty: "Keine Challenge geplant." },
  { value: "finished", label: "Abgeschlossen", empty: "Noch keine Challenge abgeschlossen." },
];

export default function AthleteChallengesPage() {
  const challenges = useMyChallenges();
  const [tab, setTab] = useState<ChallengeStatus>("running");

  return (
    <>
      <PageHeader title="Challenges" description="Deine Challenges und wie du dastehst." />
      <QueryState query={challenges} loading={<SkeletonList rows={3} className="h-36" />}>
        {({ items }) => {
          if (items.length === 0) {
            return (
              <div className="bg-surface rounded-tile">
                <EmptyState
                  icon={Trophy}
                  title="Noch nichts los hier"
                  description="Sobald dein Coach eine Challenge für dich anlegt, erscheint sie hier."
                />
              </div>
            );
          }
          const visible = items.filter((c) => c.status === tab);
          const current = tabs.find((t) => t.value === tab)!;
          return (
            <div className="flex flex-col gap-3.5">
              <SegmentedControl
                label="Challenges"
                value={tab}
                onChange={setTab}
                className="sm:self-start"
                options={tabs.map((t) => {
                  const count = items.filter((c) => c.status === t.value).length;
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
