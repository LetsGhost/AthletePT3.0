import { Link, useNavigate } from "react-router";

import { AuthCard } from "@/components/layout/auth-card";
import { useTokenFromHash } from "@/features/auth/use-token-from-hash";
import { Alert } from "@/components/ui/alert";
import { SetPasswordForm } from "@/features/auth/set-password-form";
import { rawRequest } from "@/lib/http";

export default function ResetPasswordPage() {
  const token = useTokenFromHash();
  const navigate = useNavigate();

  if (!token) {
    return (
      <AuthCard title="Link ungültig">
        <div className="flex flex-col gap-4">
          <Alert variant="error">
            Dieser Link ist unvollständig. Bitte öffne den Link aus der Mail erneut oder fordere
            einen neuen an.
          </Alert>
          <Link
            to="/forgot-password"
            className="text-accent text-sm underline-offset-4 hover:underline"
          >
            Neuen Link anfordern
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Neues Passwort" description="Lege ein neues Passwort für dein Konto fest.">
      <SetPasswordForm
        submitLabel="Passwort speichern"
        onSubmit={async (password) => {
          await rawRequest("/auth/password-reset/confirm", {
            method: "POST",
            body: { token, password },
          });
          navigate("/login", {
            replace: true,
            state: {
              notice: "Dein Passwort wurde geändert. Melde dich jetzt mit dem neuen Passwort an.",
            },
          });
        }}
      />
      <p className="text-muted mt-4 text-center text-sm">
        Link abgelaufen?{" "}
        <Link to="/forgot-password" className="text-accent underline-offset-4 hover:underline">
          Neuen anfordern
        </Link>
      </p>
    </AuthCard>
  );
}
