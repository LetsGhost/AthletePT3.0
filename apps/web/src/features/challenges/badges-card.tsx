import { badgeTierLabels, badgeTiers } from "@athletept/shared";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { useMyBadges } from "./api";
import { BadgeMedal } from "./badge-visuals";

/** Teaser auf der Fortschritt-Seite: die höchsten drei Abzeichen. */
export function MyBadgesCard() {
  const badges = useMyBadges();
  if (!badges.data) return <div className="skeleton h-28 rounded-tile" />;
  const { items, earnedCount } = badges.data;
  const rank = (tier: (typeof badgeTiers)[number] | null) => (tier ? badgeTiers.indexOf(tier) : -1);
  const top = [...items]
    .filter((b) => b.tier)
    .sort((a, b) => rank(b.tier) - rank(a.tier))
    .slice(0, 3);

  return (
    <Link
      to="/abzeichen"
      className="bg-surface hover:bg-inset flex items-center gap-3.5 rounded-tile px-4 py-3.5 transition-colors"
    >
      <span className="flex flex-1 flex-col gap-2.5">
        <span className="flex items-baseline justify-between">
          <span className="font-semibold">Abzeichen</span>
          <span className="text-muted text-xs">
            {earnedCount} von {items.length}
          </span>
        </span>
        {top.length > 0 ? (
          <span className="flex gap-4">
            {top.map((badge) => (
              <span key={badge.id} className="flex flex-col items-center gap-1">
                <BadgeMedal badge={badge} size="sm" />
                <span className="text-muted max-w-20 truncate text-[10px]">
                  {badge.name} · {badgeTierLabels[badge.tier!]}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted text-sm">Deine ersten Abzeichen warten.</span>
        )}
      </span>
      <ChevronRight aria-hidden="true" className="text-muted size-5" />
    </Link>
  );
}
