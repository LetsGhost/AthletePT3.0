import { PRIVACY_POLICY_VERSION, type InvitationInfo } from "@athletept/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";

import { homePath } from "@/app/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { useTokenFromHash } from "@/features/auth/use-token-from-hash";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import { acceptInvitation } from "@/features/auth/session";
import { SetPasswordForm, type RequiredConsent } from "@/features/auth/set-password-form";
import { errorMessage, rawRequest } from "@/lib/http";

export default function InvitePage() {
  const token = useTokenFromHash();
  const navigate = useNavigate();

  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: () =>
      rawRequest<InvitationInfo>("/auth/invitations/inspect", { method: "POST", body: { token } }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  if (!token || invitation.isError) {
    return (
      <AuthCard title="Einladung ungültig">
        <div className="flex flex-col gap-4">
          <Alert variant="error">
            {token
              ? errorMessage(invitation.error)
              : "Dieser Link ist unvollständig. Bitte öffne den Link aus der Mail erneut."}
          </Alert>
          <p className="text-muted text-sm">
            Bitte deinen Coach, dir eine neue Einladung zu schicken. Hast du schon ein Konto?
          </p>
          <Link to="/login" className="text-accent text-sm underline-offset-4 hover:underline">
            Zur Anmeldung
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (!invitation.data) {
    return <PageSpinner label="Einladung wird geprüft …" />;
  }

  const { name, email, healthDataConsentRequired } = invitation.data;
  return (
    <AuthCard
      title={`Willkommen, ${name.split(" ")[0]}!`}
      description={
        <>
          Lege ein Passwort für dein Konto <strong className="text-text break-all">{email}</strong>{" "}
          fest. Danach bist du direkt angemeldet.
        </>
      }
    >
      <SetPasswordForm
        submitLabel="Konto aktivieren"
        username={email}
        consent={healthDataConsentRequired ? healthDataConsent : undefined}
        onSubmit={async (password) => {
          const user = await acceptInvitation({
            token,
            password,
            ...(healthDataConsentRequired && {
              healthDataConsent: { accepted: true, privacyPolicyVersion: PRIVACY_POLICY_VERSION },
            }),
          });
          navigate(homePath[user.role], { replace: true });
        }}
      />
    </AuthCard>
  );
}

const healthDataConsent: RequiredConsent = {
  label: "Ich willige in die Verarbeitung meiner Gesundheitsdaten ein.",
  description: (
    <>
      Dein Coach sieht deine Angaben zu Gesundheit und Training, um dich zu betreuen (Art. 9 Abs. 2
      lit. a DSGVO). Du kannst die Einwilligung jederzeit widerrufen. Mehr dazu in der{" "}
      {/* Neuer Tab, damit das ausgefüllte Formular erhalten bleibt. */}
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
  ),
  missingMessage: "Ohne deine Einwilligung können wir dein Konto nicht aktivieren.",
};
