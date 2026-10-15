import type { UserRole } from "@athletept/shared";
import {
  ClipboardList,
  Dumbbell,
  History,
  House,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

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
    { to: "/progress", label: "Fortschritt", icon: TrendingUp },
  ],
  coach: [
    { to: "/coach/athletes", label: "Athleten", icon: Users },
    { to: "/coach/exercises", label: "Übungen", icon: Dumbbell },
    { to: "/coach/templates", label: "Vorlagen", icon: ClipboardList },
  ],
  sysadmin: [
    { to: "/admin/coaches", label: "Coaches", icon: Users },
    { to: "/admin/exercises", label: "Übungskatalog", icon: Dumbbell },
  ],
};

export const roleLabel: Record<UserRole, string> = {
  athlete: "Athlet:in",
  coach: "Coach",
  sysadmin: "Sysadmin",
};
