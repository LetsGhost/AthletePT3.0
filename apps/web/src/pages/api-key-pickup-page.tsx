import type { ApiKeyPickupResponse } from "@athletept/shared";
import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { PageSpinner } from "@/components/ui/spinner";
import { useApiKeyPickupInfo, usePickUpApiKey } from "@/features/api-keys/api";
import { ScopeList } from "@/features/api-keys/api-key-parts";
import { useSession } from "@/features/auth/session";
import { useTokenFromHash } from "@/features/auth/use-token-from-hash";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/http";

/** Zeigt den Key genau einmal. Verlässt der Nutzer die Seite, ist er nicht mehr abrufbar. */
function IssuedKey({ result }: { result: ApiKeyPickupResponse }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardHeader title={`Schlüssel für „${result.apiKey.name}“`} icon={KeyRound} />
      <CardBody className="flex flex-col gap-4">
        <Alert variant="warning" title="Nur jetzt sichtbar">
          Trage den Schlüssel jetzt in der App ein. Er wird nirgends gespeichert und lässt sich
          nicht erneut anzeigen. Gib ihn an niemanden weiter.
        </Alert>
        <code className="bg-inset rounded-card p-3 font-mono text-sm break-all select-all">
          {result.key}
        </code>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void copy()}>
            {copied ? (
              <Check aria-hidden="true" className="size-5" />
            ) : (
              <Copy aria-hidden="true" className="size-5" />
            )}
            {copied ? "Kopiert" : "Kopieren"}
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/settings">Zu den Einstellungen</Link>
          </Button>
        </div>
        <p className="text-muted text-sm">
          Gültig bis {formatDate(result.apiKey.expiresAt!)}. In den Einstellungen siehst du deine
          verbundenen Apps und kannst den Zugang jederzeit zurückziehen.
        </p>
      </CardBody>
    </Card>
  );
}

export default function ApiKeyPickupPage() {
  const token = useTokenFromHash();
  // Sysadmins bekommen nie einen Key, der Link gehört also sicher zu einem anderen Konto.
  const isSysadmin = useSession((state) => state.user?.role === "sysadmin");
  const info = useApiKeyPickupInfo(isSysadmin ? null : token);
  const pickUp = usePickUpApiKey();
  const [accepted, setAccepted] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  if (isSysadmin) {
    return (
      <>
        <PageHeader title="API-Zugang" />
        <Alert variant="error">
          Dieser Link gehört zu einem anderen Konto. Melde dich ab und mit dem Konto an, an das die
          Mail ging.
        </Alert>
      </>
    );
  }

  if (pickUp.data) {
    return (
      <>
        <PageHeader title="API-Zugang" />
        <IssuedKey result={pickUp.data} />
      </>
    );
  }

  if (!token || info.isError) {
    return (
      <>
        <PageHeader title="API-Zugang" />
        <Alert variant="error">
          {token
            ? errorMessage(info.error)
            : "Dieser Link ist unvollständig. Bitte öffne den Link aus der Mail erneut."}
        </Alert>
      </>
    );
  }

  if (!info.data) return <PageSpinner label="Link wird geprüft …" />;

  const { name, scopes, pickupExpiresAt } = info.data;
  const submit = () => {
    if (!accepted) {
      setShowMissing(true);
      return;
    }
    pickUp.mutate(token);
  };

  return (
    <>
      <PageHeader
        title="API-Zugang abholen"
        description={`Der Link ist bis ${formatDate(pickupExpiresAt)} gültig.`}
      />
      <Card>
        <CardHeader title={`App „${name}“`} icon={KeyRound} />
        <CardBody className="flex flex-col gap-4">
          <p>
            Mit dem Schlüssel greift die App in deinem Namen auf AthletePT zu. Sie darf nie mehr als
            du selbst, und nur diese Bereiche:
          </p>
          <ScopeList scopes={scopes} />
          {pickUp.isError && <Alert variant="error">{errorMessage(pickUp.error)}</Alert>}
          <CheckboxField
            label={`Ich verstehe, dass „${name}“ mit diesen Rechten auf meine Trainingsdaten zugreifen kann.`}
            description={
              <>
                Was die App mit den Daten macht, liegt in der Verantwortung ihres Anbieters. Du
                kannst den Zugang jederzeit in den Einstellungen zurückziehen. Mehr dazu in der{" "}
                <Link
                  to="/datenschutz"
                  target="_blank"
                  rel="noopener"
                  className="text-accent underline underline-offset-4"
                >
                  Datenschutzerklärung
                  <span className="sr-only"> (öffnet in neuem Tab)</span>
                </Link>
                .
              </>
            }
            checked={accepted}
            onChange={(event) => {
              setAccepted(event.target.checked);
              setShowMissing(false);
            }}
            error={showMissing ? "Bitte bestätige den Datenzugriff." : undefined}
          />
          <div>
            <Button loading={pickUp.isPending} onClick={submit}>
              Schlüssel anzeigen
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
