import { weekDayStatusLabels, type WeekDayStatus } from "@athletept/shared";

import { Badge } from "@/components/ui/badge";

const tones: Record<WeekDayStatus, "success" | "warning" | "danger" | "neutral"> = {
  open: "neutral",
  in_progress: "warning",
  completed: "success",
  skipped: "danger",
};

/** Status eines Trainingstags bzw. Protokolls (Protokolle kennen kein „Offen“). */
export function WorkoutStatusBadge({ status }: { status: WeekDayStatus }) {
  return <Badge tone={tones[status]}>{weekDayStatusLabels[status]}</Badge>;
}
