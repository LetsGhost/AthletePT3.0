import { API_KEY_EXPIRY_NOTICE_DAYS, type AdminApiKey } from "@athletept/shared";
import { Activity, Ban, KeyRound, Mail, Pencil, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { roleLabel } from "@/app/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import {
  useAdminApiKeys,
  useRenewApiKey,
  useResendPickupLink,
  useRevokeApiKey,
} from "@/features/api-keys/api";
import { ApiKeyDates, ApiKeyStatusBadge, ScopeList } from "@/features/api-keys/api-key-parts";
import {
  ApiKeyAuditDialog,
  CreateApiKeyDialog,
  EditApiKeyDialog,
} from "@/features/api-keys/api-key-dialogs";
import { errorMessage } from "@/lib/http";

type Action = { type: "edit" | "audit" | "revoke"; apiKey: AdminApiKey } | null;

const NOTICE_MS = API_KEY_EXPIRY_NOTICE_DAYS * 24 * 60 * 60 * 1000;

function expiresSoon(apiKey: AdminApiKey) {
  return (
    apiKey.status === "active" &&
    apiKey.expiresAt !== null &&
    Date.parse(apiKey.expiresAt) - Date.now() <= NOTICE_MS
  );
}

function ApiKeyRow({
  apiKey,
  successor,
  onAction,
}: {
  apiKey: AdminApiKey;
  /** Laufende Erneuerung dieses Keys (wartet auf Abholung oder aktiv). */
  successor: AdminApiKey | undefined;
  onAction: (type: "edit" | "audit" | "revoke") => void;
}) {
  const resend = useResendPickupLink();
  const renew = useRenewApiKey();
  const open = apiKey.status === "pending" || apiKey.status === "active";
  const renewable = (apiKey.status === "active" || apiKey.status === "expired") && !successor;

  const handleRenew = async () => {
    try {
      const renewed = await renew.mutateAsync(apiKey.id);
      toast(
        renewed.mailSent
          ? `Neuer Abhol-Link an ${apiKey.user.email} verschickt. Der alte Zugang gilt bis zu seinem Ablauf weiter.`
          : "Erneuerung angelegt, aber die Mail konnte nicht verschickt werden. Bitte erneut senden.",
        renewed.mailSent ? "success" : "error",
      );
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const handleResend = async () => {
    try {
      const { mailSent } = await resend.mutateAsync(apiKey.id);
      toast(
        mailSent
          ? `Neuer Abhol-Link an ${apiKey.user.email} verschickt.`
          : "Die Mail konnte nicht verschickt werden.",
        mailSent ? "success" : "error",
      );
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{apiKey.name}</p>
          <ApiKeyStatusBadge status={apiKey.status} />
          {expiresSoon(apiKey) && !successor && <Badge tone="warning">Läuft bald ab</Badge>}
        </div>
        {successor && (
          <p className="text-muted text-sm">
            Erneuert: Der neue Zugang{" "}
            {successor.status === "pending" ? "wartet auf Abholung" : "ist aktiv"}.
          </p>
        )}
        {apiKey.renewedFromId && (
          <p className="text-muted text-sm">Erneuerung eines früheren Zugangs.</p>
        )}
        <p className="text-sm">
          {apiKey.user.name}{" "}
          <span className="text-muted">
            ({roleLabel[apiKey.user.role]}, <span className="break-all">{apiKey.user.email}</span>)
          </span>
        </p>
        <ScopeList scopes={apiKey.scopes} />
        <ApiKeyDates apiKey={apiKey} />
        <p className="text-muted text-sm">
          {apiKey.requestCount} Anfragen · Limit {apiKey.rateLimit} je 15 Min.
        </p>
        <div className="flex flex-wrap gap-2">
          {apiKey.status === "pending" && (
            <Button
              variant="secondary"
              size="sm"
              loading={resend.isPending}
              onClick={() => void handleResend()}
            >
              <Mail aria-hidden="true" className="size-4" /> Link erneut senden
            </Button>
          )}
          {renewable && (
            <Button
              variant={expiresSoon(apiKey) || apiKey.status === "expired" ? "secondary" : "ghost"}
              size="sm"
              loading={renew.isPending}
              onClick={() => void handleRenew()}
            >
              <RefreshCw aria-hidden="true" className="size-4" /> Erneuern
            </Button>
          )}
          {open && (
            <Button variant="ghost" size="sm" onClick={() => onAction("edit")}>
              <Pencil aria-hidden="true" className="size-4" /> Bearbeiten
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onAction("audit")}>
            <Activity aria-hidden="true" className="size-4" /> Nutzung
          </Button>
          {open && (
            <Button variant="ghost" size="sm" onClick={() => onAction("revoke")}>
              <Ban aria-hidden="true" className="size-4" /> Zurückziehen
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}

export default function ApiKeysPage() {
  const apiKeys = useAdminApiKeys();
  const revoke = useRevokeApiKey();
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const close = (open: boolean) => !open && setAction(null);

  const handleRevoke = async (apiKey: AdminApiKey) => {
    try {
      await revoke.mutateAsync(apiKey.id);
      toast(`Zugang „${apiKey.name}“ zurückgezogen.`);
      setAction(null);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <>
      <PageHeader
        title="API-Zugänge"
        description="Externe Apps greifen im Namen eines Coaches oder Athleten zu, nie mit mehr Rechten als der Nutzer selbst."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-5" /> Zugang anlegen
          </Button>
        }
      />

      <QueryState query={apiKeys} loading={<SkeletonList />}>
        {(list) =>
          list.length === 0 ? (
            <Card>
              <EmptyState
                icon={KeyRound}
                title="Noch keine API-Zugänge"
                description="Lege einen Zugang an. Der Nutzer bekommt einen Link per Mail und holt den Schlüssel selbst ab."
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((apiKey) => (
                <ApiKeyRow
                  key={apiKey.id}
                  apiKey={apiKey}
                  successor={list.find(
                    (other) =>
                      other.renewedFromId === apiKey.id &&
                      (other.status === "pending" || other.status === "active"),
                  )}
                  onAction={(type) => setAction({ type, apiKey })}
                />
              ))}
            </ul>
          )
        }
      </QueryState>

      <CreateApiKeyDialog open={createOpen} onOpenChange={setCreateOpen} />
      {action?.type === "edit" && (
        <EditApiKeyDialog apiKey={action.apiKey} open onOpenChange={close} />
      )}
      {action?.type === "audit" && (
        <ApiKeyAuditDialog apiKey={action.apiKey} open onOpenChange={close} />
      )}
      {action?.type === "revoke" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`„${action.apiKey.name}“ zurückziehen?`}
          description="Die App verliert sofort den Zugriff. Das lässt sich nicht rückgängig machen; für einen neuen Zugang bekommt der Nutzer einen neuen Link."
          confirmLabel="Zurückziehen"
          destructive
          loading={revoke.isPending}
          onConfirm={() => void handleRevoke(action.apiKey)}
        />
      )}
    </>
  );
}
