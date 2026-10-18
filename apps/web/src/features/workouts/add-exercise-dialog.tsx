import { MAX_EXERCISE_SETS } from "@athletept/shared";
import { Minus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { NumberField, TextField } from "@/components/ui/text-field";

import { createCustomExercise, type DraftExercise } from "./draft";
import { parseDecimal } from "./format";

const pauses = ["60", "90", "120", "180"] as const;
type Pause = (typeof pauses)[number];
const pauseOptions = pauses.map((value) => ({ value, label: `${value} s` }));

interface Values {
  name: string;
  setCount: number;
  reps: string;
  weight: string;
  pause: Pause;
}

const initialValues: Values = { name: "", setCount: 3, reps: "", weight: "", pause: "90" };

type Errors = Partial<Record<"name" | "reps" | "weight", string>>;

function validate(values: Values) {
  const errors: Errors = {};
  const name = values.name.trim();
  if (name.length < 2) errors.name = "Mindestens 2 Zeichen";
  else if (name.length > 80) errors.name = "Höchstens 80 Zeichen";

  const repsText = values.reps.trim();
  const reps = repsText === "" ? null : Number(repsText);
  if (reps !== null && (!Number.isInteger(reps) || reps < 1 || reps > 100)) {
    errors.reps = "Ganze Zahl von 1 bis 100";
  }
  const weightKg = parseDecimal(values.weight);
  if (weightKg !== null && (Number.isNaN(weightKg) || weightKg < 0 || weightKg > 1000)) {
    errors.weight = "Zahl von 0 bis 1000";
  }
  return { errors, reps, weightKg };
}

interface AddExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (exercise: DraftExercise) => void;
}

/** Übung nur für dieses Training: Name und Sätze, dazu optional Wdh., Gewicht und Pause. */
export function AddExerciseDialog({ open, onOpenChange, onAdd }: AddExerciseDialogProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Errors>({});
  const set = (next: Partial<Values>) => setValues((v) => ({ ...v, ...next }));

  const close = (o: boolean) => {
    if (!o) {
      setValues(initialValues);
      setErrors({});
    }
    onOpenChange(o);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const { errors: invalid, reps, weightKg } = validate(values);
    setErrors(invalid);
    if (Object.keys(invalid).length > 0) return;
    onAdd(
      createCustomExercise({
        name: values.name,
        setCount: values.setCount,
        reps,
        weightKg,
        restSeconds: Number(values.pause),
      }),
    );
    close(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Übung hinzufügen"
      description="Nur für dieses Training, dein Plan bleibt unverändert."
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Name"
          autoComplete="off"
          maxLength={80}
          placeholder="z. B. Butterfly, Rudern einarmig"
          value={values.name}
          error={errors.name}
          onChange={(e) => set({ name: e.target.value })}
        />

        <div className="flex items-center justify-between gap-4">
          <span id="add-exercise-sets" className="text-sm font-medium">
            Sätze
          </span>
          <div
            role="group"
            aria-labelledby="add-exercise-sets"
            className="bg-inset flex items-center rounded-card p-1"
          >
            <Button
              variant="secondary"
              size="sm"
              aria-label="Ein Satz weniger"
              disabled={values.setCount <= 1}
              onClick={() => set({ setCount: values.setCount - 1 })}
            >
              <Minus aria-hidden="true" className="size-4" />
            </Button>
            <output aria-live="polite" className="min-w-11 text-center font-semibold tabular-nums">
              {values.setCount}
            </output>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Ein Satz mehr"
              disabled={values.setCount >= MAX_EXERCISE_SETS}
              onClick={() => set({ setCount: values.setCount + 1 })}
            >
              <Plus aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Wdh. (optional)"
            inputMode="numeric"
            placeholder="10"
            value={values.reps}
            error={errors.reps}
            onChange={(e) => set({ reps: e.target.value })}
          />
          <NumberField
            label="Gewicht (optional)"
            unit="kg"
            placeholder="0"
            value={values.weight}
            error={errors.weight}
            onChange={(e) => set({ weight: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" aria-hidden="true">
            Pause
          </span>
          <SegmentedControl
            label="Pause"
            options={pauseOptions}
            value={values.pause}
            onChange={(pause) => set({ pause })}
            className="bg-inset"
          />
        </div>

        <Button type="submit" size="lg">
          <Plus aria-hidden="true" className="size-5" /> Übung hinzufügen
        </Button>
      </form>
    </Dialog>
  );
}
