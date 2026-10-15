import { CheckboxField } from "@/components/ui/checkbox-field";
import { SelectField } from "@/components/ui/select-field";
import { formatClock } from "@/features/workouts/format";
import {
  restDefaultOptions,
  setRestSettings,
  useRestSettings,
} from "@/features/workouts/rest-timer/rest-settings";

const options = restDefaultOptions.map((seconds) => ({
  value: String(seconds),
  label: seconds < 60 ? `${seconds} s` : `${formatClock(seconds)} min`,
}));

/** Pausen-Timer im Training ein-/ausschalten und Standardpause wählen. */
export function RestTimerSettings() {
  const { enabled, defaultSeconds } = useRestSettings();

  return (
    <div className="flex max-w-md flex-col gap-4">
      <CheckboxField
        label="Pausen-Timer"
        description="Startet nach jedem abgehakten Satz und meldet sich mit Ton und Vibration, wenn die Pause vorbei ist."
        checked={enabled}
        onChange={(e) => setRestSettings({ enabled: e.target.checked })}
      />
      <SelectField
        label="Standardpause"
        hint="Für Übungen ohne Pausenvorgabe deines Coaches. Seine Vorgabe hat immer Vorrang."
        options={options}
        value={String(defaultSeconds)}
        disabled={!enabled}
        onChange={(e) => setRestSettings({ defaultSeconds: Number(e.target.value) })}
      />
      <p className="text-muted text-sm">Gilt nur für dieses Gerät.</p>
    </div>
  );
}
