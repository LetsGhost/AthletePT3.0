import type { ApiKey } from "@athletept/shared";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import { errorMessage } from "@/lib/http";

import { useMyApiKeys, useRevokeMyApiKey } from "./api";
import { ApiKeyDates, ApiKeyStatusBadge, ScopeList } from "./api-key-parts";

/** Verbundene Apps in den Einstellungen: ansehen und zurückziehen, anlegen nur durch den Sysadmin. */
export function MyApiKeys() {
  const apiKeys = useMyApiKeys();
  const revoke = useRevokeMyApiKey();
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const handleRevoke = async (apiKey: ApiKey) => {
    try {
      await revoke.mutateAsync(apiKey.id);
      toast(`Zugang „${apiKey.name}“ zurückgezogen.`);
      setRevoking(null);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <QueryState query={apiKeys} loading={<SkeletonList />}>
      {(list) =>
        list.length === 0 ? (
          <p className="text-muted text-sm">
            Keine verbundenen Apps. Zugänge für externe Apps richtet der Sysadmin ein.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {list.map((apiKey) => (
                <li key={apiKey.id} className="bg-inset flex flex-col gap-2 rounded-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{apiKey.name}</p>
                    <ApiKeyStatusBadge status={apiKey.status} />
                  </div>
                  <ScopeList scopes={apiKey.scopes} />
                  <ApiKeyDates apiKey={apiKey} />
                  {(apiKey.status === "active" || apiKey.status === "pending") && (
                    <div>
                      <Button variant="secondary" size="sm" onClick={() => setRevoking(apiKey)}>
                        Zugang zurückziehen
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {revoking && (
              <ConfirmDialog
                open
                onOpenChange={(open) => !open && setRevoking(null)}
                title={`„${revoking.name}“ zurückziehen?`}
                description="Die App verliert sofort den Zugriff. Für einen neuen Zugang wende dich an den Sysadmin."
                confirmLabel="Zurückziehen"
                destructive
                loading={revoke.isPending}
                onConfirm={() => void handleRevoke(revoking)}
              />
            )}
          </>
        )
      }
    </QueryState>
  );
}
