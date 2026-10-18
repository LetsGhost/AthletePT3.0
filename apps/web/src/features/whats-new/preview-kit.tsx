/**
 * Bausteine für die Vorschau-Bilder im „Was ist neu“-Dialog. Sie zeichnen eine vereinfachte
 * Mini-Version der App-Oberfläche, nur aus Design-Tokens (funktioniert hell und dunkel).
 * Alles ist rein dekorativ: Der Dialog blendet die Vorschau für Screenreader aus, der Text
 * darunter erklärt die Neuerung.
 *
 * Anleitung und Beispiele: README.md in diesem Ordner.
 */
import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import type { WhatsNewTone } from "./types";

const toneText: Record<WhatsNewTone, string> = {
  accent: "text-accent",
  records: "text-module-records",
};

const toneBg: Record<WhatsNewTone, string> = {
  accent: "bg-accent/12",
  records: "bg-module-records/14",
};

/** Untereinander gestapelte Bausteine. `center` zentriert sie (z. B. Icon über einer Karte). */
export function PreviewStack({
  center = false,
  children,
}: {
  center?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-2.5", center && "items-center")}>{children}</div>
  );
}

/** Nebeneinander, gleich breit verteilt (z. B. drei Kacheln). */
export function PreviewGrid({
  columns = 3,
  children,
}: {
  columns?: 2 | 3 | 4;
  children: ReactNode;
}) {
  return (
    <div
      className="grid w-full gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

/**
 * Elemente nebeneinander, z. B. ein Satz mit Haken. `box`: mit Hintergrund,
 * `highlight`: eingefärbt wie die aktive Zeile im Training. Ohne: nur die Anordnung
 * (z. B. innerhalb einer `PreviewCard`).
 */
export function PreviewRow({
  variant = "plain",
  children,
}: {
  variant?: "plain" | "box" | "highlight";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2.5",
        variant !== "plain" && "rounded-xl px-2.5 py-2",
        variant === "box" && "bg-surface",
        variant === "highlight" && "bg-primary/22",
      )}
    >
      {children}
    </div>
  );
}

/** Karte mit Rahmen. `tone` färbt Rahmen und Hintergrund. */
export function PreviewCard({
  tone,
  className,
  children,
}: {
  tone?: WhatsNewTone | "primary";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-[14px] border px-3 py-2.5",
        !tone && "border-border bg-surface",
        tone === "primary" && "border-primary bg-primary/30",
        tone === "accent" && "border-accent/40 bg-accent/8",
        tone === "records" && "border-module-records/30 bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Text in der Vorschau. `small` für Beschriftungen, `big` für große Zahlen. */
export function PreviewText({
  size = "md",
  muted = false,
  tone,
  grow = false,
  align = "left",
  children,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  muted?: boolean;
  tone?: WhatsNewTone;
  /** Nimmt den freien Platz in einer Zeile ein. */
  grow?: boolean;
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "block leading-tight",
        size === "sm" && "text-[11px]",
        size === "md" && "text-[13px]",
        size === "lg" && "text-sm font-semibold",
        size === "xl" && "text-[22px] font-semibold",
        muted && "text-muted",
        tone && cn(toneText[tone], "font-semibold"),
        grow && "flex-1",
        align === "right" && "text-right",
      )}
    >
      {children}
    </span>
  );
}

/** Mehrere Texte untereinander, z. B. Titel und Untertitel. */
export function PreviewTextGroup({
  grow = false,
  align = "left",
  children,
}: {
  grow?: boolean;
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <span
      className={cn("flex flex-col gap-0.5", grow && "flex-1", align === "right" && "items-end")}
    >
      {children}
    </span>
  );
}

/** Runde Nummer, z. B. die Satznummer. */
export function PreviewNumber({ children }: { children: ReactNode }) {
  return (
    <span className="bg-primary text-on-primary flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs font-semibold">
      {children}
    </span>
  );
}

/** Abgehakter Haken-Button. */
export function PreviewCheck() {
  return (
    <span className="bg-primary text-on-primary flex size-[30px] shrink-0 items-center justify-center rounded-[9px]">
      <Check className="size-4" strokeWidth={3} />
    </span>
  );
}

/** Kleiner Knopf mit Rahmen, z. B. „+15“. */
export function PreviewChip({ children }: { children: ReactNode }) {
  return (
    <span className="border-accent/50 flex h-[30px] min-w-[38px] shrink-0 items-center justify-center rounded-[9px] border px-1.5 text-[11px] font-semibold">
      {children}
    </span>
  );
}

/** Button. `dashed`: gestrichelter „Hinzufügen“-Knopf. */
export function PreviewButton({
  variant = "primary",
  children,
}: {
  variant?: "primary" | "outline" | "dashed";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex h-9 w-full items-center justify-center rounded-[10px] text-[13px] font-semibold",
        variant === "primary" && "bg-primary text-on-primary",
        variant === "outline" && "border-border-strong border",
        variant === "dashed" && "border-border-strong text-accent border-[1.5px] border-dashed",
      )}
    >
      {children}
    </span>
  );
}

/** Eingabefeld mit Beschriftung. `focused` zeigt Fokusrahmen und Cursor. */
export function PreviewInput({
  label,
  value,
  focused = false,
}: {
  label?: string;
  value: string;
  focused?: boolean;
}) {
  return (
    <span className="flex w-full flex-col gap-1.5">
      {label && <span className="text-muted text-[11px]">{label}</span>}
      <span
        className={cn(
          "bg-bg flex h-10 items-center rounded-[10px] border px-3 text-sm",
          focused ? "border-accent ring-accent/20 ring-[3px]" : "border-border",
        )}
      >
        {value}
        {focused && <span className="bg-accent ml-0.5 h-[18px] w-0.5" />}
      </span>
    </span>
  );
}

/** Zahl mit − und +, z. B. Anzahl Sätze. */
export function PreviewStepper({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="flex w-full items-center justify-between">
      <span className="text-[12px]">{label}</span>
      <span className="bg-bg border-border inline-flex items-center gap-1 rounded-[10px] border p-0.5">
        <span className="bg-surface flex size-7 items-center justify-center rounded-[7px]">−</span>
        <span className="min-w-[26px] text-center font-semibold">{value}</span>
        <span className="bg-surface flex size-7 items-center justify-center rounded-[7px]">+</span>
      </span>
    </span>
  );
}

/** Fortschrittsbalken, `value` von 0 bis 1. */
export function PreviewProgress({ value }: { value: number }) {
  return (
    <span className="bg-text/12 block h-1 w-full rounded-full">
      <span
        className="bg-accent block h-full rounded-full"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </span>
  );
}

/** Großes, leicht leuchtendes Icon. Auch die Vorschau, wenn eine Neuerung keine eigene hat. */
export function PreviewIcon({
  icon: Icon,
  tone = "accent",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: WhatsNewTone;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        toneBg[tone],
        toneText[tone],
        size === "md" ? "size-[54px] rounded-2xl" : "size-20 rounded-3xl",
        tone === "records"
          ? "shadow-[0_0_30px_color-mix(in_srgb,var(--module-records)_20%,transparent)]"
          : "shadow-[0_0_30px_color-mix(in_srgb,var(--accent)_18%,transparent)]",
      )}
    >
      <Icon className={size === "md" ? "size-7" : "size-10"} strokeWidth={2} />
    </span>
  );
}

/** Platzhalter-Kachel mit zwei Strichen, z. B. für „Sätze“ oder „Karten“. */
export function PreviewTile({ filled = false }: { filled?: boolean }) {
  return (
    <span className="bg-surface border-border flex h-[70px] flex-col justify-end gap-[5px] rounded-xl border p-2">
      <span className="bg-border-strong/50 block h-1 w-3/5 rounded-full" />
      <span
        className={cn(
          "block h-1 w-[85%] rounded-full",
          filled ? "bg-accent" : "bg-border-strong/50",
        )}
      />
    </span>
  );
}

/**
 * Screenshot oder Grafik. Bild in diesem Ordner unter `images/` ablegen und importieren:
 * `import timer from "./images/3.2-timer.webp";` → `<PreviewImage src={timer} />`.
 */
export function PreviewImage({ src }: { src: string }) {
  return <img src={src} alt="" className="h-full max-h-full w-full rounded-xl object-contain" />;
}
