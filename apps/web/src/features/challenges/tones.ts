import type { ChallengeKind, ChallengeMetricGroup } from "@athletept/shared";
import {
  CalendarCheck,
  Globe,
  Layers,
  Pencil,
  Swords,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Farben je Art: Text, Hintergrund (getönt) und Füllung für Balken. */
export const kindTone: Record<ChallengeKind, { text: string; tint: string; fill: string }> = {
  system: {
    text: "text-challenge-system",
    tint: "bg-challenge-system/15",
    fill: "bg-challenge-system",
  },
  duel: { text: "text-challenge-duel", tint: "bg-challenge-duel/15", fill: "bg-challenge-duel" },
  coach: {
    text: "text-challenge-coach",
    tint: "bg-challenge-coach/15",
    fill: "bg-challenge-coach",
  },
};

export const kindIcon: Record<ChallengeKind, LucideIcon> = {
  system: Globe,
  duel: Swords,
  coach: UserRound,
};

export const metricGroupIcon: Record<ChallengeMetricGroup, LucideIcon> = {
  consistency: CalendarCheck,
  volume: Layers,
  performance: Zap,
  manual: Pencil,
};
