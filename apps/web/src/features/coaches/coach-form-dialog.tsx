import {
  athleteQuotaSchema,
  createCoachRequestSchema,
  personNameSchema,
  type Coach,
} from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ComponentProps } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { NumberField, TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast-store";
import { applyApiErrors } from "@/lib/form";
import { numberInput } from "@/lib/form-values";

import { useCoaches, useCreateCoach, useUpdateCoach } from "./api";

const editSchema = z.object({
  name: personNameSchema,
  athleteQuota: athleteQuotaSchema,
  disabled: z.boolean(),
  /** Leer, solange keine Übergabe nötig ist. */
  reassignToCoachId: z.string(),
});

type CreateValues = z.input<typeof createCoachRequestSchema>;
type EditValues = z.infer<typeof editSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteCoachDialog({ open, onOpenChange }: Props) {
  const createCoach = useCreateCoach();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createCoachRequestSchema),
    defaultValues: { athleteQuota: 5 },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const coach = await createCoach.mutateAsync(createCoachRequestSchema.parse(values));
      if (coach.inviteSent) {
        toast(`Einladung an ${coach.email} verschickt.`);
      } else {
        toast(
          "Coach angelegt, aber die Mail konnte nicht verschickt werden. Bitte erneut senden.",
          "error",
        );
      }
      reset();
      onOpenChange(false);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["email", "name", "athleteQuota"]));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Coach einladen"
      description="Der Coach bekommt eine Mail mit einem Link, über den er sein Passwort festlegt."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField
          label="Name"
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label="E-Mail"
          type="email"
          required
          autoComplete="off"
          error={errors.email?.message}
          {...register("email")}
        />
        <NumberField
          label="Kontingent"
          hint="Wie viele Athleten der Coach gleichzeitig betreuen darf."
          unit="Athleten"
          required
          error={errors.athleteQuota?.message}
          {...register("athleteQuota", numberInput)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Einladen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Freie Plätze im Kontingent eines Coaches. */
function freeSlots(coach: Coach) {
  return Math.max(coach.athleteQuota - coach.athleteCount, 0);
}

export function EditCoachDialog({ coach, ...props }: Props & { coach: Coach }) {
  const updateCoach = useUpdateCoach();
  const coaches = useCoaches();
  const [formError, setFormError] = useState<string | null>(null);
  const athleteTotal = coach.athleteCount + coach.archivedAthleteCount;
  // Wer gesperrt wird und noch Athleten hat, muss sie an einen anderen aktiven Coach übergeben.
  const mustReassign = (disabled: boolean) =>
    disabled && coach.status !== "disabled" && athleteTotal > 0;

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(
      editSchema.refine((data) => !mustReassign(data.disabled) || data.reassignToCoachId, {
        path: ["reassignToCoachId"],
        message: "Bitte wähle einen Coach, der die Athleten übernimmt",
      }),
    ),
    values: {
      name: coach.name,
      athleteQuota: coach.athleteQuota,
      disabled: coach.status === "disabled",
      reassignToCoachId: "",
    },
  });
  const reassigning = mustReassign(useWatch({ control, name: "disabled" }));
  const candidates = (coaches.data ?? []).filter(
    (other) => other.id !== coach.id && other.status === "active",
  );

  const onSubmit = handleSubmit(async ({ name, athleteQuota, disabled, reassignToCoachId }) => {
    setFormError(null);
    try {
      await updateCoach.mutateAsync({
        id: coach.id,
        name,
        athleteQuota,
        // Eingeladene Coaches können nur gesperrt, aber nicht manuell aktiviert werden.
        ...(coach.status !== "invited" || disabled
          ? { status: disabled ? "disabled" : "active" }
          : {}),
        ...(mustReassign(disabled) && { reassignToCoachId }),
      });
      const target = candidates.find((other) => other.id === reassignToCoachId);
      toast(
        mustReassign(disabled) && target
          ? `${name} ist gesperrt. ${athleteTotal} ${athleteTotal === 1 ? "Athlet wurde" : "Athleten wurden"} an ${target.name} übergeben.`
          : "Änderungen gespeichert.",
      );
      props.onOpenChange(false);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["name", "athleteQuota", "reassignToCoachId"]));
    }
  });

  return (
    <Dialog {...props} title="Coach bearbeiten" description={coach.email}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField label="Name" required error={errors.name?.message} {...register("name")} />
        <NumberField
          label="Kontingent"
          unit="Athleten"
          required
          hint={
            coach.athleteCount > 0
              ? `Aktuell belegt: ${coach.athleteCount}. Ein kleineres Kontingent entfernt niemanden, verhindert aber neue Einladungen.`
              : undefined
          }
          error={errors.athleteQuota?.message}
          {...register("athleteQuota", numberInput)}
        />
        <CheckboxField
          label="Zugang sperren"
          tone="danger"
          description={
            coach.status !== "disabled" && athleteTotal > 0
              ? "Der Coach wird sofort abgemeldet und kann sich nicht mehr anmelden. Seine Athleten gehen mit allen Daten an einen anderen Coach."
              : "Der Coach wird sofort abgemeldet und kann sich nicht mehr anmelden."
          }
          {...register("disabled")}
        />
        {reassigning && (
          <ReassignField
            coach={coach}
            candidates={candidates}
            loading={coaches.isPending}
            error={errors.reassignToCoachId?.message}
            {...register("reassignToCoachId")}
          />
        )}
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

interface ReassignFieldProps extends Omit<ComponentProps<"select">, "id"> {
  coach: Coach;
  /** Aktive Coaches außer dem, der gesperrt wird. */
  candidates: Coach[];
  loading: boolean;
  error?: string | undefined;
}

/** Auswahl des Coaches, der beim Sperren alle Athleten übernimmt. */
function ReassignField({ coach, candidates, loading, error, ...props }: ReassignFieldProps) {
  const total = coach.athleteCount + coach.archivedAthleteCount;
  const needed = coach.athleteCount;

  let hint = `Übernimmt ${total === 1 ? "den Athleten" : `alle ${total} Athleten`} von ${coach.name}`;
  if (coach.archivedAthleteCount > 0) {
    hint += `, davon ${coach.archivedAthleteCount} archiviert (zählen nicht aufs Kontingent)`;
  }
  hint += `. Benötigt ${needed} ${needed === 1 ? "freien Platz" : "freie Plätze"}.`;
  if (!loading && candidates.length === 0) {
    hint =
      "Es gibt keinen anderen aktiven Coach. Lade zuerst einen Coach ein, der die Athleten übernehmen kann.";
  }

  return (
    <SelectField
      label="Athleten übergeben an"
      required
      placeholder={loading ? "Coaches werden geladen …" : "Coach auswählen"}
      hint={hint}
      error={error}
      options={candidates.map((candidate) => {
        const free = freeSlots(candidate);
        return {
          value: candidate.id,
          label:
            free >= needed
              ? `${candidate.name} (${free} frei)`
              : `${candidate.name} (nur ${free} frei, Kontingent reicht nicht)`,
          disabled: free < needed,
        };
      })}
      {...props}
    />
  );
}
