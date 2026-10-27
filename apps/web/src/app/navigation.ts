import type { UserRole } from "@athletept/shared";
import {
  ClipboardList,
  Dumbbell,
  History,
  House,
  KeyRound,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

/** `handle` einer Route. `wide`: Seite nutzt die volle Breite (z. B. Plan-Editor). */
export interface RouteHandle {
  wide?: boolean;
}

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Nur bei exakter URL aktiv markieren. */
  end?: boolean;
}

/** Startseite je Rolle. */
export const homePath: Record<UserRole, string> = {
  athlete: "/dashboard",
  coach: "/coach/athletes",
  sysadmin: "/admin/coaches",
};

/** Hauptnavigation je Rolle. Neue Bereiche werden hier ergänzt, sobald sie fertig sind. */
export const navigation: Record<UserRole, NavItem[]> = {
  athlete: [
    { to: "/dashboard", label: "Übersicht", icon: House },
    { to: "/plan", label: "Training", icon: Dumbbell },
    { to: "/workouts", label: "Verlauf", icon: History },
    { to: "/fortschritt", label: "Fortschritt", icon: TrendingUp },
  ],
  coach: [
    { to: "/coach/athletes", label: "Athleten", icon: Users },
    { to: "/coach/exercises", label: "Übungen", icon: Dumbbell },
    { to: "/coach/templates", label: "Vorlagen", icon: ClipboardList },
    { to: "/coach/challenges", label: "Challenges", icon: Trophy },
  ],
  sysadmin: [
    { to: "/admin/coaches", label: "Coaches", icon: Users },
    { to: "/admin/exercises", label: "Übungskatalog", icon: Dumbbell },
    { to: "/admin/api-keys", label: "API-Zugänge", icon: KeyRound },
  ],
};

export const roleLabel: Record<UserRole, string> = {
  athlete: "Athlet:in",
  coach: "Coach",
  sysadmin: "Sysadmin",
};
