import { passwordResetRequestSchema, type PasswordResetRequest } from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";

import { AuthCard } from "@/components/layout/auth-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { errorMessage, rawRequest } from "@/lib/http";

const linkClasses = "text-accent self-center text-sm underline-offset-4 hover:underline";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequest>({ resolver: zodResolver(passwordResetRequestSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await rawRequest("/auth/password-reset/request", { method: "POST", body: values });
      setSentTo(values.email);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  if (sentTo) {
    return (
      <AuthCard title="Schau in dein Postfach">
        <div className="flex flex-col gap-4">
          <MailCheck aria-hidden="true" className="text-success size-10" />
          <p role="status">
            Falls ein Konto mit <strong className="break-all">{sentTo}</strong> existiert, haben wir
            dir einen Link zum Zurücksetzen geschickt. Er ist 60 Minuten gültig.
          </p>
          <p className="text-muted text-sm">Keine Mail bekommen? Sieh auch im Spam-Ordner nach.</p>
          <Link to="/login" className={linkClasses}>
            Zurück zur Anmeldung
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Passwort vergessen"
      description="Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegen kannst."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField
          label="E-Mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
          Link anfordern
        </Button>
        <Link to="/login" className={linkClasses}>
          Zurück zur Anmeldung
        </Link>
      </form>
    </AuthCard>
  );
}
