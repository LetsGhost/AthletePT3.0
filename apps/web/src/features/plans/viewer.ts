import { useSession } from "@/features/auth/session";

/**
 * Pläne bearbeitet der Coach oder, mit der Berechtigung „Eigener Trainingsplan“, der Athlet
 * selbst. Beide nutzen dieselben Komponenten, nur Links und Texte unterscheiden sich.
 */
export type PlanViewer = "coach" | "athlete";

export function usePlanViewer(): PlanViewer {
  return useSession((state) => (state.user?.role === "athlete" ? "athlete" : "coach"));
}

export function planPath(viewer: PlanViewer, athleteId: string, planId: string) {
  return viewer === "athlete" ? `/plans/${planId}` : `/coach/athletes/${athleteId}/plans/${planId}`;
}

/** Wohin es nach dem Löschen eines Plans zurückgeht. */
export function plansHomePath(viewer: PlanViewer, athleteId: string) {
  return viewer === "athlete" ? "/plan" : `/coach/athletes/${athleteId}`;
}
