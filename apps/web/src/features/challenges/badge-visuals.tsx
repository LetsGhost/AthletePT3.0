import type { Badge } from "@athletept/shared";

import { cn } from "@/lib/cn";

const images = import.meta.glob<string>("./images/*.svg", { eager: true, import: "default" });

const files: Record<Badge["icon"], string> = {
  flame: "serien-starter",
  calendar: "monats-konstanz",
  volume: "tonnage",
  sunrise: "fruehaufsteher",
  duel: "duellant",
  coach: "team-player",
  system_consistency: "system-konstanz",
  system_volume: "system-volumen",
  system_performance: "system-leistung",
};

const tierFiles = { bronze: "bronze", silver: "silber", gold: "gold" } as const;

/** Grafik zu Motiv und Stufe, Stufe `null` ergibt die gesperrte Variante. */
export function BadgeImage({
  icon,
  tier,
  size = "md",
}: Pick<Badge, "icon" | "tier"> & { size?: "sm" | "md" }) {
  return (
    <img
      src={images[`./images/${files[icon]}-${tier ? tierFiles[tier] : "gesperrt"}.svg`]}
      alt=""
      aria-hidden="true"
      className={cn("shrink-0", size === "sm" ? "size-10" : "size-14")}
    />
  );
}

/** Abzeichen-Grafik der erreichten Stufe, gesperrte Variante solange offen. */
export function BadgeMedal({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" }) {
  return <BadgeImage icon={badge.icon} tier={badge.tier} size={size} />;
}
