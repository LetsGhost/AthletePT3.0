import {
  createExerciseRequestSchema,
  equipmentLabels,
  equipmentTypes,
  exerciseCategories,
  exerciseCategoryLabels,
  exerciseSearchKey,
  MAX_EXERCISE_ALIASES,
  type Exercise,
  type MuscleGroup,
} from "@athletept/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChipCheckboxGroup } from "@/components/ui/chip-checkbox-group";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import { applyApiErrors } from "@/lib/form";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { useCreateExercise, useExerciseSearch, useUpdateExercise } from "./api";
import { muscleGroupsByRegion, muscleSummary } from "./labels";

const splitAliases = (value: string) =>
  value
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean);

/**
 * Synonyme werden im Formular als kommagetrennter Text erfasst und schon hier geprüft, damit
 * Fehler am Textfeld erscheinen. Danach validiert das Request-Schema der API alles Weitere.
 */
const formSchema = z
  .object({
    name: z.string(),
    aliases: z
      .string()
      .refine(
        (value) => splitAliases(value).length <= MAX_EXERCISE_ALIASES,
        `Höchstens ${MAX_EXERCISE_ALIASES} Synonyme`,
      )
      .refine(
        (value) => splitAliases(value).every((alias) => alias.length <= 80),
        "Ein Synonym darf höchstens 80 Zeichen lang sein",
      )
      .transform(splitAliases),
    category: z.string(),
    equipment: z.string(),
    primaryMuscles: z.array(z.string()),
    secondaryMuscles: z.array(z.string()),
    description: z.string(),
    executionNotes: z.string(),
    videoUrl: z.string(),
  })
  // Nur ein Typ-Übergang: Kategorie, Equipment und Muskelgruppen prüft das Request-Schema.
  .transform((values) => values as z.input<typeof createExerciseRequestSchema>)
  .pipe(createExerciseRequestSchema);

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const fields = [
  "name",
  "aliases",
  "category",
  "equipment",
  "primaryMuscles",
  "secondaryMuscles",
  "description",
  "executionNotes",
  "videoUrl",
] as const;

function toFormValues(exercise?: Exercise): FormInput {
  return {
    name: exercise?.name ?? "",
    aliases: exercise?.aliases.join(", ") ?? "",
    category: exercise?.category ?? "",
    equipment: exercise?.equipment ?? "",
    primaryMuscles: exercise?.primaryMuscles ?? [],
    secondaryMuscles: exercise?.secondaryMuscles ?? [],
    description: exercise?.description ?? "",
    executionNotes: exercise?.executionNotes ?? "",
    videoUrl: exercise?.videoUrl ?? "",
  };
}

interface ExerciseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ohne Übung: neu anlegen. */
  exercise?: Exercise | undefined;
  /**
   * `own`: Coach legt eigene an (mit Hinweis auf gleichnamige Katalog-Übungen). `private`: Athlet
   * legt private an (mit Vorschlägen ähnlicher Übungen, Duplikate lehnt die API ab).
   */
  catalog: "global" | "own" | "private";
  /** Vorbelegter Name, z. B. aus der Übungsauswahl. */
  initialName?: string;
  onSaved?: (exercise: Exercise) => void;
  /** Statt anzulegen eine vorgeschlagene Übung verwenden, z. B. in der Übungsauswahl. */
  onUseExisting?: (exercise: Exercise) => void;
}

export function ExerciseFormDialog({
  open,
  onOpenChange,
  exercise,
  catalog,
  initialName,
  onSaved,
  onUseExisting,
}: ExerciseFormDialogProps) {
  const createExercise = useCreateExercise();
  const updateExercise = useUpdateExercise();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...toFormValues(exercise), ...(initialName ? { name: initialName } : {}) },
  });

  const name = useWatch({ control, name: "name" });
  const primaryMuscles = useWatch({ control, name: "primaryMuscles" }) as MuscleGroup[];
  const sameNameInCatalog = useSameNameInCatalog(catalog === "own" ? name : "");
  const similar = useSimilarExercises(catalog === "private" && !exercise ? name : "");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = exercise
        ? await updateExercise.mutateAsync({ id: exercise.id, ...values })
        : await createExercise.mutateAsync(values);
      toast(exercise ? "Übung gespeichert." : `„${saved.name}“ angelegt.`);
      reset(toFormValues(saved));
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, fields));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={exercise ? "Übung bearbeiten" : "Neue Übung"}
      description={
        catalog === "private"
          ? "Private Übungen siehst nur du. Dein Coach kann sie prüfen und in seinen Katalog übernehmen."
          : catalog === "own"
            ? "Eigene Übungen siehst nur du."
            : "Globale Übungen sehen alle Coaches, ändern kannst nur du."
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField
          label="Name"
          required
          autoComplete="off"
          error={errors.name?.message}
          hint={
            sameNameInCatalog &&
            sameNameInCatalog.id !== exercise?.id &&
            `Im Katalog gibt es bereits „${sameNameInCatalog.name}“. Du kannst trotzdem eine eigene Variante anlegen.`
          }
          {...register("name")}
        />
        {similar.length > 0 && (
          <Alert variant="info" title="Meinst du eine dieser Übungen?">
            <p className="mb-2">Gibt es die Übung schon, verwende bitte die vorhandene.</p>
            <ul className="flex flex-col gap-2" aria-label="Ähnliche Übungen">
              {similar.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{item.name}</span>
                    <span className="text-muted block text-sm">{muscleSummary(item)}</span>
                  </span>
                  {onUseExisting && (
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`${item.name} verwenden`}
                      onClick={() => {
                        onUseExisting(item);
                        onOpenChange(false);
                      }}
                    >
                      Verwenden
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <TextField
          label="Synonyme"
          autoComplete="off"
          hint={`Andere Bezeichnungen, mit Komma getrennt (höchstens ${MAX_EXERCISE_ALIASES}). Die Suche findet sie mit.`}
          error={errors.aliases?.message}
          {...register("aliases")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Kategorie"
            required
            placeholder="Bitte wählen"
            options={exerciseCategories.map((value) => ({
              value,
              label: exerciseCategoryLabels[value],
            }))}
            error={errors.category?.message}
            {...register("category")}
          />
          <SelectField
            label="Equipment"
            required
            placeholder="Bitte wählen"
            options={equipmentTypes.map((value) => ({ value, label: equipmentLabels[value] }))}
            error={errors.equipment?.message}
            {...register("equipment")}
          />
        </div>
        <Controller
          control={control}
          name="primaryMuscles"
          render={({ field, fieldState }) => (
            <ChipCheckboxGroup
              legend="Primäre Muskelgruppen"
              required
              groups={muscleGroupsByRegion}
              value={field.value as MuscleGroup[]}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="secondaryMuscles"
          render={({ field, fieldState }) => (
            <ChipCheckboxGroup
              legend="Sekundäre Muskelgruppen"
              hint="Werden mittrainiert. Primär gewählte Gruppen sind hier nicht wählbar."
              groups={muscleGroupsByRegion}
              value={field.value as MuscleGroup[]}
              onChange={field.onChange}
              disabledValues={primaryMuscles}
              error={fieldState.error?.message}
            />
          )}
        />
        <TextareaField
          label="Beschreibung"
          error={errors.description?.message}
          {...register("description")}
        />
        <TextareaField
          label="Ausführungshinweise"
          hint="Worauf Athleten achten sollen, z. B. Tempo, Atmung, typische Fehler."
          error={errors.executionNotes?.message}
          {...register("executionNotes")}
        />
        <TextField
          label="Video-Link"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          hint="Optional, z. B. ein YouTube-Video zur Ausführung."
          error={errors.videoUrl?.message}
          {...register("videoUrl")}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {exercise ? "Speichern" : "Anlegen"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Globale Übung mit (normalisiert) gleichem Namen, für den Hinweis beim Anlegen eigener Übungen. */
function useSameNameInCatalog(name: string) {
  const key = exerciseSearchKey(useDebouncedValue(name, 300));
  const search = useExerciseSearch(
    { search: key, scope: "global" },
    { enabled: key.length >= 2, limit: 5 },
  );
  if (key.length < 2) return null;
  return search.data?.items.find((item) => exerciseSearchKey(item.name) === key) ?? null;
}

/** Sichtbare Übungen, deren Name oder Synonym den eingegebenen Namen enthält (höchstens drei). */
function useSimilarExercises(name: string) {
  const key = exerciseSearchKey(useDebouncedValue(name, 300));
  const search = useExerciseSearch({ search: key }, { enabled: key.length >= 3, limit: 3 });
  return key.length >= 3 ? (search.data?.items ?? []) : [];
}
