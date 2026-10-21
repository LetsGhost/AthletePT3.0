import {
  API_KEY_DEFAULT_RATE_LIMIT,
  API_KEY_PICKUP_DAYS,
  apiKeyNameSchema,
  apiKeyRateLimitSchema,
  apiKeyScopesSchema,
  createApiKeyRequestSchema,
  type AdminApiKey,
  type ApiKeyScope,
} from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChipCheckboxGroup } from "@/components/ui/chip-checkbox-group";
import { Dialog } from "@/components/ui/dialog";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { NumberField, TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast-store";
import { applyApiErrors } from "@/lib/form";
import { numberInput } from "@/lib/form-values";
import { formatDateTime } from "@/lib/format";

import { useApiKeyAudit, useCreateApiKey, useUpdateApiKey } from "./api";
import { scopeGroups } from "./labels";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CreateValues = z.input<typeof createApiKeyRequestSchema>;

export function CreateApiKeyDialog({ open, onOpenChange }: Props) {
  const createApiKey = useCreateApiKey();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createApiKeyRequestSchema),
    defaultValues: { scopes: [], rateLimit: API_KEY_DEFAULT_RATE_LIMIT },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const apiKey = await createApiKey.mutateAsync(createApiKeyRequestSchema.parse(values));
      toast(
        apiKey.mailSent
          ? `Abhol-Link an ${apiKey.user.email} verschickt.`
          : "Zugang angelegt, aber die Mail konnte nicht verschickt werden. Bitte erneut senden.",
        apiKey.mailSent ? "success" : "error",
      );
      reset();
      onOpenChange(false);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["email", "name", "scopes", "rateLimit"]));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="API-Zugang anlegen"
      description={`Der Nutzer bekommt einen Link per Mail (${API_KEY_PICKUP_DAYS} Tage gültig) und sieht den Schlüssel nach dem Anmelden genau einmal. Du siehst ihn nie.`}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField
          label="E-Mail des Coaches oder Athleten"
          type="email"
          required
          autoComplete="off"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Name der App"
          hint="Sieht der Nutzer in der Mail und in seinen Einstellungen."
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
        <Controller
          control={control}
          name="scopes"
          render={({ field, fieldState }) => (
            <ChipCheckboxGroup
              legend="Bereiche"
              required
              groups={scopeGroups(null)}
              value={field.value}
              onChange={field.onChange}
              hint="Die App darf nie mehr als der Nutzer selbst. Später lassen sich Bereiche nur noch einschränken."
              error={fieldState.error?.message}
            />
          )}
        />
        <NumberField
          label="Rate-Limit"
          unit="Anfragen je 15 Min."
          required
          error={errors.rateLimit?.message}
          {...register("rateLimit", numberInput)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Anlegen und Link senden
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const editSchema = z.object({
  name: apiKeyNameSchema,
  scopes: apiKeyScopesSchema,
  rateLimit: apiKeyRateLimitSchema,
});
type EditValues = z.input<typeof editSchema>;

export function EditApiKeyDialog({ apiKey, ...props }: Props & { apiKey: AdminApiKey }) {
  const updateApiKey = useUpdateApiKey();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: { name: apiKey.name, scopes: apiKey.scopes, rateLimit: apiKey.rateLimit },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await updateApiKey.mutateAsync({ id: apiKey.id, ...editSchema.parse(values) });
      toast("Änderungen gespeichert.");
      props.onOpenChange(false);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["name", "scopes", "rateLimit"]));
    }
  });

  return (
    <Dialog
      {...props}
      title="API-Zugang bearbeiten"
      description={`${apiKey.user.name} · ${apiKey.user.email}`}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField
          label="Name der App"
          required
          error={errors.name?.message}
          {...register("name")}
        />
        <Controller
          control={control}
          name="scopes"
          render={({ field, fieldState }) => (
            <ChipCheckboxGroup<ApiKeyScope>
              legend="Bereiche"
              required
              groups={scopeGroups(apiKey.user.role, apiKey.scopes)}
              value={field.value}
              onChange={field.onChange}
              hint="Abwählen wirkt sofort. Für zusätzliche Bereiche einen neuen Zugang anlegen."
              error={fieldState.error?.message}
            />
          )}
        />
        <NumberField
          label="Rate-Limit"
          unit="Anfragen je 15 Min."
          required
          error={errors.rateLimit?.message}
          {...register("rateLimit", numberInput)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => props.onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ApiKeyAuditDialog({ apiKey, ...props }: Props & { apiKey: AdminApiKey }) {
  const audit = useApiKeyAudit(apiKey.id);
  return (
    <Dialog
      {...props}
      title={`Nutzung: ${apiKey.name}`}
      description={`${apiKey.requestCount} Anfragen insgesamt. Hier stehen die letzten Schreibzugriffe der vergangenen 90 Tage, ohne Inhalte.`}
    >
      <QueryState query={audit} loading={<SkeletonList />}>
        {({ items }) =>
          items.length === 0 ? (
            <p className="text-muted text-sm">Noch keine Schreibzugriffe.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {items.map((entry, index) => (
                <li key={index} className="bg-inset flex flex-wrap gap-x-3 rounded-card px-3 py-2">
                  <span className="text-muted">{formatDateTime(entry.createdAt)}</span>
                  <span className="font-mono break-all">
                    {entry.method} {entry.path}
                  </span>
                  <span className={entry.status >= 400 ? "text-danger" : "text-success"}>
                    {entry.status}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </Dialog>
  );
}
