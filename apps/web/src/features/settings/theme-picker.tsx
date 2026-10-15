import { Monitor, Moon, Sun } from "lucide-react";

import { useSession } from "@/features/auth/session";
import { cn } from "@/lib/cn";

import { setThemePreference, useThemePreference, type ThemePreference } from "./theme";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "system", label: "Wie Gerät", icon: Monitor },
];

export function ThemePicker() {
  const role = useSession((state) => state.user?.role);
  const current = useThemePreference(role);

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium">Farbschema</legend>
      <div className="grid max-w-md grid-cols-3 gap-2">
        {options.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 p-3 text-sm",
              "has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2",
              current === value
                ? "border-accent bg-inset"
                : "border-border hover:border-border-strong",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={current === value}
              onChange={() => setThemePreference(value)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
