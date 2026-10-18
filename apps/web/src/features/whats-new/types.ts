import type { AthletePermission, UserRole } from "@athletept/shared";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Farbe für Icon und Vorschau: `accent` (Türkis) oder `records` (Gold, z. B. für Rekorde). */
export type WhatsNewTone = "accent" | "records";

/** Eine Neuerung = eine Seite im Dialog. */
export interface WhatsNewItem {
  title: string;
  /** Ein bis zwei Sätze, in Du-Form. */
  text: string;
  icon: LucideIcon;
  tone?: WhatsNewTone;
  /** Bild oben im Dialog, gebaut aus `preview-kit.tsx`. Ohne: großes Icon. */
  preview?: ReactNode;
  /** Nur für diese Rollen. Ohne: für alle Rollen des Releases. */
  roles?: UserRole[];
  /**
   * Nur für Athleten, denen der Coach all diese Berechtigungen freigegeben hat, z. B. `ownPlan`.
   * Andere Rollen sehen die Seite dann nie.
   */
  permissions?: AthletePermission[];
}

export interface WhatsNewRelease {
  /** Eindeutig und nach dem Veröffentlichen nie mehr ändern: daran merkt sich die App „gesehen“. */
  id: string;
  /** Angezeigt als „Neu in Version …“. */
  version: string;
  /** Erscheinungsdatum (YYYY-MM-DD). */
  date: string;
  /** Nur für diese Rollen. Ohne: für alle. */
  roles?: UserRole[];
  items: WhatsNewItem[];
}
