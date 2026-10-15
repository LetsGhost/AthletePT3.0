import { loginRequestSchema, type LoginRequest } from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router";

import { AuthCard } from "@/components/layout/auth-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { login } from "@/features/auth/session";
import { errorMessage } from "@/lib/http";

export function LoginPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  // Nach erfolgreichem Login leitet <PublicOnly> automatisch weiter.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthCard title="Anmelden" description="Willkommen zurück! Melde dich mit deinem Konto an.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {notice && !formError && <Alert variant="success">{notice}</Alert>}
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
        <PasswordField
          label="Passwort"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
          Anmelden
        </Button>
        <Link
          to="/forgot-password"
          className="text-accent self-center text-sm underline-offset-4 hover:underline"
        >
          Passwort vergessen?
        </Link>
      </form>
    </AuthCard>
  );
}
