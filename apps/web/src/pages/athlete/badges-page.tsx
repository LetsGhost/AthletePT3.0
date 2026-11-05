import {
  badgeGroupLabels,
  badgeGroups,
  badgeTierLabels,
  badgeTiers,
  type Badge,
  type BadgeGroup,
} from "@athletept/shared";
import { ArrowLeft, Award } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMyBadges } from "@/features/challenges/api";
import { BadgeMedal } from "@/features/challenges/badge-visuals";
import { tierTone } from "@/features/challenges/tones";
import { cn } from "@/lib/cn";

type Filter = BadgeGroup | "all";

function BadgeDialog({ badge, onClose }: { badge: Badge; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={badge.name}>
      <div className="flex flex-col items-center gap-4 text-center">
        <BadgeMedal badge={badge} />
        <p className="text-muted text-sm">{badge.description}</p>
        <ol className="grid w-full grid-cols-3 gap-2">
          {badgeTiers.map((tier, index) => {
            const reached = badge.tier !== null && index <= badgeTiers.indexOf(badge.tier);
            return (
              <li
                key={tier}
                className={cn(
                  "bg-inset flex flex-col gap-0.5 rounded-card p-2.5",
                  reached && "ring-1 ring-current",
                  reached && tierTone[tier],
                )}
              >
                <span className="text-xs font-semibold">{badgeTierLabels[tier]}</span>
                <span className="text-text text-sm">{badge.thresholds[index]}</span>
              </li>
            );
          })}
        </ol>
        <p className="text-sm font-medium">{badge.progress}</p>
        {badge.challengeId && (
          <Button asChild variant="secondary">
            <Link to={`/challenges/${badge.challengeId}`}>Zur Challenge</Link>
          </Button>
        )}
      </div>
    </Dialog>
  );
}

export default function BadgesPage() {
  const badges = useMyBadges();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Badge | null>(null);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <title>Abzeichen · AthletePT</title>
      <Link to="/fortschritt" className="text-muted inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft aria-hidden="true" className="size-4" /> Fortschritt
      </Link>
      <QueryState query={badges} loading={<SkeletonList rows={4} className="h-28" />}>
        {({ items, earnedCount }) => {
          const visible = items.filter((b) => filter === "all" || b.group === filter);
          return (
            <>
              <div>
                <h1 className="text-2xl font-medium sm:text-3xl">Abzeichen</h1>
                <p className="text-muted mt-1 text-sm">
                  {earnedCount} von {items.length} verdient · keine Punkte, kein Level, nur echte
                  Leistung.
                </p>
              </div>
              {earnedCount === 0 && (
                <div className="bg-surface rounded-tile">
                  <EmptyState
                    icon={Award}
                    title="Noch keine Abzeichen"
                    description="Abzeichen verdienst du mit Trainingsserien, Rekorden und Challenges. Dein erstes ist näher, als du denkst."
                  />
                </div>
              )}
              <ul aria-label="Stufen" className="grid grid-cols-3 gap-2">
                {[...badgeTiers].reverse().map((tier) => (
                  <li key={tier} className="bg-surface flex items-center gap-2.5 rounded-tile p-3">
                    <span
                      aria-hidden="true"
                      className={cn("size-3 rounded-full bg-current", tierTone[tier])}
                    />
                    <span className="flex flex-col">
                      <span className="text-lg leading-none font-semibold">
                        {items.filter((b) => b.tier === tier).length}
                      </span>
                      <span className="text-muted text-xs">{badgeTierLabels[tier]}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <SegmentedControl
                label="Filter"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all" as const, label: "Alle" },
                  ...badgeGroups.map((g) => ({ value: g, label: badgeGroupLabels[g] })),
                ]}
              />
              {badgeGroups
                .filter((group) => filter === "all" || filter === group)
                .map((group) => {
                  const list = visible.filter((b) => b.group === group);
                  if (list.length === 0) return null;
                  return (
                    <section
                      key={group}
                      aria-labelledby={`badges-${group}`}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-baseline justify-between px-0.5">
                        <h2 id={`badges-${group}`} className="font-semibold">
                          {badgeGroupLabels[group]}
                        </h2>
                        <span className="text-muted text-xs">
                          {list.filter((b) => b.tier).length} von {list.length}
                        </span>
                      </div>
                      <ul className="grid grid-cols-3 gap-2">
                        {list.map((badge) => (
                          <li key={badge.id}>
                            <button
                              type="button"
                              onClick={() => setOpen(badge)}
                              className="bg-surface hover:bg-inset flex h-full w-full flex-col items-center gap-2 rounded-tile p-3 text-center transition-colors"
                            >
                              <BadgeMedal badge={badge} />
                              <span className="text-xs leading-tight font-semibold">
                                {badge.name}
                              </span>
                              <span className="text-muted text-[11px] leading-tight">
                                {badge.tier ? badgeTierLabels[badge.tier] : "Noch offen"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              {open && <BadgeDialog badge={open} onClose={() => setOpen(null)} />}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
