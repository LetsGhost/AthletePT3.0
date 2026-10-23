import { changePasswordRequestSchema, PASSWORD_MIN_LENGTH } from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast-store";
import { api } from "@/lib/api";
import { applyApiErrors } from "@/lib/form";

const formSchema = changePasswordRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Die Passwörter stimmen nicht überein",
  });

type FormValues = z.infer<typeof formSchema>;

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      reset();
      toast("Passwort geändert. Andere Geräte wurden abgemeldet.");
      onDone?.();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["currentPassword", "newPassword"]));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert variant="error">{formError}</Alert>}
      <PasswordField
        label="Aktuelles Passwort"
        autoComplete="current-password"
        required
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <PasswordField
        label="Neues Passwort"
        autoComplete="new-password"
        required
        hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen. Ein Satz aus mehreren Wörtern ist leicht zu merken und sicher.`}
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <PasswordField
        label="Neues Passwort wiederholen"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" loading={isSubmitting}>
        Passwort ändern
      </Button>
    </form>
  );
}
