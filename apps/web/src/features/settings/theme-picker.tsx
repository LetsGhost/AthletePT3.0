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
    <fieldset className="p-3.5">
      <legend className="float-left mb-2.5 w-full text-sm font-medium">Farbschema</legend>
      <div className="bg-inset clear-both grid grid-cols-3 gap-1 rounded-card p-1">
        {options.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-medium",
              "has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2",
              current === value ? "bg-primary text-on-primary" : "text-muted hover:text-text",
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
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
