import type { UserStatus } from "@athletept/shared";

import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: UserStatus;
  /** Bezeichnung für `disabled`: bei Coaches „Gesperrt“, bei Athleten „Archiviert“. */
  disabledLabel?: string;
}

export function StatusBadge({ status, disabledLabel = "Gesperrt" }: StatusBadgeProps) {
  if (status === "active") return <Badge tone="success">Aktiv</Badge>;
  if (status === "invited") return <Badge tone="warning">Eingeladen</Badge>;
  return <Badge tone="neutral">{disabledLabel}</Badge>;
}
