import { PASSWORD_MIN_LENGTH, passwordSchema } from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { PasswordField } from "@/components/ui/text-field";
import { applyApiErrors } from "@/lib/form";

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string(), consent: z.boolean() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Die Passwörter stimmen nicht überein",
  });

type Values = z.infer<typeof schema>;

/** Pflicht-Checkbox, ohne die sich das Formular nicht abschicken lässt. */
export interface RequiredConsent {
  label: ReactNode;
  description?: ReactNode;
  /** Fehlertext, wenn nicht angehakt. */
  missingMessage: string;
}

interface SetPasswordFormProps {
  submitLabel: string;
  onSubmit: (password: string) => Promise<void>;
  /** Nutzername für Passwortmanager (verstecktes Feld). */
  username?: string;
  consent?: RequiredConsent | undefined;
}

/** Neues Passwort mit Wiederholung, für Einladung und Passwort-Reset. */
export function SetPasswordForm({
  submitLabel,
  onSubmit,
  username,
  consent,
}: SetPasswordFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(
      consent
        ? schema.refine((data) => data.consent, {
            path: ["consent"],
            message: consent.missingMessage,
          })
        : schema,
    ),
    defaultValues: { consent: false },
  });

  const submit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await onSubmit(password);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["password"]));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {formError && <Alert variant="error">{formError}</Alert>}
      {username && (
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={username}
          readOnly
          hidden
        />
      )}
      <PasswordField
        label="Neues Passwort"
        autoComplete="new-password"
        required
        hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen. Ein Satz aus mehreren Wörtern ist leicht zu merken und sicher.`}
        error={errors.password?.message}
        {...register("password")}
      />
      <PasswordField
        label="Passwort wiederholen"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      {consent && (
        <CheckboxField
          label={consent.label}
          description={consent.description}
          required
          error={errors.consent?.message}
          {...register("consent")}
        />
      )}
      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
        {submitLabel}
      </Button>
    </form>
  );
}
