import type { Badge } from "@athletept/shared";
import {
  Award,
  CalendarCheck,
  Flame,
  Globe,
  Layers,
  Sunrise,
  Swords,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";

import { tierTone } from "./tones";

const icons: Record<Badge["icon"], LucideIcon> = {
  flame: Flame,
  calendar: CalendarCheck,
  volume: Layers,
  sunrise: Sunrise,
  duel: Swords,
  coach: UserRound,
  system: Globe,
};

/** Rundes Abzeichen, gefärbt nach erreichter Stufe, grau solange offen. */
export function BadgeMedal({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" }) {
  const Icon = icons[badge.icon] ?? Award;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border-2",
        size === "sm" ? "size-10" : "size-14",
        badge.tier ? "bg-surface border-current" : "bg-inset border-border border-dashed",
        badge.tier ? tierTone[badge.tier] : "text-border-strong",
      )}
    >
      <Icon className={size === "sm" ? "size-5" : "size-6"} />
    </span>
  );
}
