import {
  athleteProfileSchema,
  emailSchema,
  personNameSchema,
  sexes,
  sexLabels,
  type AthleteProfile,
} from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { NumberField, TextField } from "@/components/ui/text-field";
import { applyApiErrors } from "@/lib/form";
import { numberInput, optionalText } from "@/lib/form-values";

export interface AthleteFormValues {
  name: string;
  email?: string;
  profile: AthleteProfile;
}

const createSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  profile: athleteProfileSchema,
});
const editSchema = z.object({ name: personNameSchema, profile: athleteProfileSchema });

interface AthleteFormProps {
  mode: "create" | "edit";
  defaultValues?: AthleteFormValues;
  submitLabel: string;
  onSubmit: (values: AthleteFormValues) => Promise<void>;
  onCancel?: () => void;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-border flex flex-col gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true">
        <p className="font-medium">{title}</p>
        {description && <p className="text-muted text-sm">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const fieldPaths = [
  "name",
  "email",
  ...Object.keys(athleteProfileSchema.shape).map((key) => `profile.${key}` as const),
] as const;

/** Stammdaten und Anamnese eines Athleten. Alle Anamnese-Felder sind optional. */
export function AthleteForm({
  mode,
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: AthleteFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AthleteFormValues>({
    resolver: zodResolver(mode === "create" ? createSchema : editSchema) as never,
    defaultValues: defaultValues ?? { name: "", email: "", profile: {} },
  });
  const p = errors.profile;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, fieldPaths as never));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {formError && <Alert variant="error">{formError}</Alert>}

      <Section title="Kontakt">
        <TextField
          label="Name"
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
        {mode === "create" && (
          <TextField
            label="E-Mail"
            type="email"
            required
            autoComplete="off"
            hint="An diese Adresse geht die Einladung."
            error={errors.email?.message}
            {...register("email")}
          />
        )}
      </Section>

      <Section title="Körperdaten">
        <TextField
          label="Geburtsdatum"
          type="date"
          error={p?.birthDate?.message}
          {...register("profile.birthDate", optionalText)}
        />
        <SelectField
          label="Geschlecht"
          placeholder="Keine Angabe"
          options={sexes.map((value) => ({ value, label: sexLabels[value] }))}
          error={p?.sex?.message}
          {...register("profile.sex", optionalText)}
        />
        <NumberField
          label="Größe"
          unit="cm"
          error={p?.heightCm?.message}
          {...register("profile.heightCm", numberInput)}
        />
      </Section>

      <Section title="Ziele">
        <TextField
          label="Ziel"
          placeholder="z. B. Fett abbauen, Kraft halten"
          error={p?.goal?.message}
          {...register("profile.goal", optionalText)}
        />
        <TextField
          label="Fokus"
          placeholder="z. B. Oberkörper"
          error={p?.focus?.message}
          {...register("profile.focus", optionalText)}
        />
        <NumberField
          label="Trainings pro Woche"
          error={p?.trainingsPerWeek?.message}
          {...register("profile.trainingsPerWeek", numberInput)}
        />
      </Section>

      <Section title="Alltag und Sport">
        <TextField
          label="Wo wird trainiert?"
          placeholder="z. B. Fitnessstudio, zu Hause"
          error={p?.trainingLocation?.message}
          {...register("profile.trainingLocation", optionalText)}
        />
        <TextField
          label="Wann wird trainiert?"
          placeholder="z. B. abends unter der Woche"
          error={p?.trainingTimes?.message}
          {...register("profile.trainingTimes", optionalText)}
        />
        <TextareaField
          label="Andere Sportarten"
          error={p?.otherSports?.message}
          {...register("profile.otherSports", optionalText)}
        />
        <TextareaField
          label="Cardio"
          error={p?.cardio?.message}
          {...register("profile.cardio", optionalText)}
        />
      </Section>

      <Section
        title="Gesundheit"
        description="Wird vertraulich behandelt und nur dir als Coach angezeigt."
      >
        <TextareaField
          label="Körperliche Beschwerden"
          error={p?.physicalIssues?.message}
          {...register("profile.physicalIssues", optionalText)}
        />
        <TextareaField
          label="Vorerkrankungen und Besonderheiten"
          error={p?.conditions?.message}
          {...register("profile.conditions", optionalText)}
        />
      </Section>

      <Section title="Notizen" description="Nur für dich sichtbar.">
        <TextareaField
          label="Interne Notizen"
          rows={4}
          className="sm:col-span-2"
          error={p?.coachNotes?.message}
          {...register("profile.coachNotes", optionalText)}
        />
      </Section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
