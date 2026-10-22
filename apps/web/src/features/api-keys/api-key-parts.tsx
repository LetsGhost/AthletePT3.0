import type { ApiKey, ApiKeyScope, ApiKeyStatus } from "@athletept/shared";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

import { scopeLabels } from "./labels";

export function ApiKeyStatusBadge({ status }: { status: ApiKeyStatus }) {
  if (status === "active") return <Badge tone="success">Aktiv</Badge>;
  if (status === "pending") return <Badge tone="warning">Wartet auf Abholung</Badge>;
  if (status === "expired") return <Badge tone="neutral">Abgelaufen</Badge>;
  return <Badge tone="danger">Zurückgezogen</Badge>;
}

export function ScopeList({ scopes }: { scopes: readonly ApiKeyScope[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Bereiche">
      {scopes.map((scope) => (
        <li key={scope} className="bg-inset rounded-full px-2.5 py-0.5 text-xs">
          {scopeLabels[scope]}
        </li>
      ))}
    </ul>
  );
}

/** Kurzinfo zu Laufzeit und Nutzung, wie sie Nutzer und Sysadmin sehen. */
export function ApiKeyDates({ apiKey }: { apiKey: ApiKey }) {
  const parts: string[] = [];
  if (apiKey.keyPreview) parts.push(`${apiKey.keyPreview}…`);
  if (apiKey.status === "pending" && apiKey.pickupExpiresAt) {
    parts.push(`Abhol-Link gültig bis ${formatDate(apiKey.pickupExpiresAt)}`);
  }
  if (apiKey.expiresAt && apiKey.status !== "revoked") {
    parts.push(
      `${apiKey.status === "expired" ? "Abgelaufen am" : "Gültig bis"} ${formatDate(apiKey.expiresAt)}`,
    );
  }
  if (apiKey.status !== "pending") {
    parts.push(
      apiKey.lastUsedAt ? `Zuletzt genutzt ${formatDate(apiKey.lastUsedAt)}` : "Noch nie genutzt",
    );
  }
  return <p className="text-muted text-sm">{parts.join(" · ")}</p>;
}
