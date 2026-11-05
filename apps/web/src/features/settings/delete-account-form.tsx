import { deleteAccountRequestSchema, type DeleteAccountRequest } from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast-store";
import { useLogout } from "@/features/auth/use-logout";
import { api } from "@/lib/api";
import { applyApiErrors } from "@/lib/form";

export function DeleteAccountForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const handleLogout = useLogout();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountRequest>({ resolver: zodResolver(deleteAccountRequestSchema) });

  const onSubmit = handleSubmit(async (body) => {
    setFormError(null);
    try {
      await api("/auth/delete-account", { method: "POST", body });
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["password"]));
      return;
    }
    toast("Dein Konto wurde gelöscht.");
    await handleLogout();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Alert variant="warning">
        Dein Konto und alle deine Daten (Pläne, Trainings, Challenges) werden sofort und endgültig
        gelöscht. Das lässt sich nicht rückgängig machen.
      </Alert>
      {formError && <Alert variant="error">{formError}</Alert>}
      <PasswordField
        label="Passwort zur Bestätigung"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" variant="danger" loading={isSubmitting}>
        Konto endgültig löschen
      </Button>
    </form>
  );
}
