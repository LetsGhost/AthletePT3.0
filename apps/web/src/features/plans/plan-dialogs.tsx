import { planContentSchema, type CreatePlanRequest, type PlanTemplate } from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast-store";
import { useAthletes } from "@/features/athletes/api";
import { api } from "@/lib/api";
import { applyApiErrors } from "@/lib/form";

import { templateKeys, useCreatePlan, useCreateTemplate, useTemplates } from "./api";
import { copyContent, type EditorValues } from "./editor-values";

const nameSchema = planContentSchema.shape.name;

interface DialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const newPlanSchema = z.object({ name: nameSchema, templateId: z.string() });

/** Neuer Plan für einen Athleten: leer oder als Kopie einer Vorlage. */
export function NewPlanDialog({
  athleteId,
  open,
  onOpenChange,
}: DialogBaseProps & { athleteId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const templates = useTemplates();
  const createPlan = useCreatePlan();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(newPlanSchema),
    defaultValues: { name: "", templateId: "" },
  });

  const onSubmit = handleSubmit(async ({ name, templateId }) => {
    setFormError(null);
    try {
      let body: CreatePlanRequest = { name, days: [] };
      if (templateId) {
        const template = await queryClient.fetchQuery({
          queryKey: templateKeys.detail(templateId),
          queryFn: () => api<PlanTemplate>(`/plan-templates/${templateId}`),
        });
        body = copyContent(template, name);
      }
      const plan = await createPlan.mutateAsync({ athleteId, ...body });
      toast(`Entwurf „${plan.name}“ angelegt.`);
      onOpenChange(false);
      navigate(`/coach/athletes/${athleteId}/plans/${plan.id}`);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["name"]));
    }
  });

  const templateOptions = (templates.data?.items ?? []).map((t) => ({
    value: t.id,
    label: `${t.name} (${t.dayCount} ${t.dayCount === 1 ? "Tag" : "Tage"})`,
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Neuer Plan"
      description="Neue Pläne sind Entwürfe. Der Athlet sieht sie erst, wenn du sie aktivierst."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <SelectField
          label="Vorlage"
          placeholder="Leerer Plan"
          options={templateOptions}
          disabled={templates.isPending}
          hint={
            templates.isError
              ? "Vorlagen konnten nicht geladen werden. Du kannst trotzdem leer starten."
              : templates.data?.items.length === 0
                ? "Du hast noch keine Vorlagen."
                : undefined
          }
          {...register("templateId", {
            onChange: (event: { target: { value: string } }) => {
              const template = templates.data?.items.find((t) => t.id === event.target.value);
              if (template && !getValues("name")) setValue("name", template.name);
            },
          })}
        />
        <TextField
          label="Name"
          required
          autoComplete="off"
          placeholder="z. B. Hypertrophie Block 1"
          error={errors.name?.message}
          {...register("name")}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Anlegen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const duplicateSchema = z.object({
  name: nameSchema,
  athleteId: z.string().min(1, "Bitte wählen"),
});

interface CopySource {
  name: string;
  notes: string | null;
  days: Parameters<typeof copyContent>[0]["days"];
}

/** Kopiert einen Plan als Entwurf, für denselben oder einen anderen eigenen Athleten. */
export function DuplicatePlanDialog({
  source,
  athleteId,
  open,
  onOpenChange,
}: DialogBaseProps & { source: CopySource; athleteId: string }) {
  const navigate = useNavigate();
  const athletes = useAthletes();
  const createPlan = useCreatePlan();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(duplicateSchema),
    defaultValues: { name: `${source.name} (Kopie)`.slice(0, 80), athleteId },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const plan = await createPlan.mutateAsync({
        athleteId: values.athleteId,
        ...copyContent(source, values.name),
      });
      toast(`Entwurf „${plan.name}“ angelegt.`);
      onOpenChange(false);
      navigate(`/coach/athletes/${values.athleteId}/plans/${plan.id}`);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["name"]));
    }
  });

  const options = (athletes.data?.items ?? [])
    .filter((a) => a.status !== "disabled" || a.id === athleteId)
    .map((a) => ({ value: a.id, label: a.name }));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Plan duplizieren"
      description="Die Kopie wird als Entwurf angelegt."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <SelectField
          label="Für Athlet"
          required
          options={options.length > 0 ? options : [{ value: athleteId, label: "Aktueller Athlet" }]}
          error={errors.athleteId?.message}
          {...register("athleteId")}
        />
        <TextField
          label="Name"
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Duplizieren
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const templateNameSchema = z.object({ name: nameSchema });

/**
 * Neue Vorlage: leer (`source` fehlt) oder als Kopie eines Plans. Öffnet danach die Vorlage.
 */
export function NewTemplateDialog({
  source,
  open,
  onOpenChange,
}: DialogBaseProps & { source?: CopySource }) {
  const navigate = useNavigate();
  const createTemplate = useCreateTemplate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(templateNameSchema),
    defaultValues: { name: source?.name ?? "" },
  });

  const onSubmit = handleSubmit(async ({ name }) => {
    setFormError(null);
    try {
      const body: EditorValues = source ? copyContent(source, name) : { name, days: [] };
      const template = await createTemplate.mutateAsync(body);
      toast(`Vorlage „${template.name}“ gespeichert.`);
      onOpenChange(false);
      navigate(`/coach/templates/${template.id}`);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["name"]));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={source ? "Als Vorlage speichern" : "Neue Vorlage"}
      description="Vorlagen siehst nur du. Aus ihnen legst du Pläne für deine Athleten an."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField
          label="Name der Vorlage"
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {source ? "Speichern" : "Anlegen"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
