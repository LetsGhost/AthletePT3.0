import { nicknameSchema } from "@athletept/shared";
import { Check, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/http";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { useNicknameCheck, useUpdateChallengeSettings } from "./api";

interface NicknameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nach dem Speichern, z. B. um direkt beizutreten. */
  onSaved: () => void;
  current?: string | null;
  submitLabel?: string;
}

/** Spitzname wählen: Prüfung beim Tippen, freie Vorschläge, wenn der Name vergeben ist. */
export function NicknameDialog({
  open,
  onOpenChange,
  onSaved,
  current = null,
  submitLabel = "Speichern",
}: NicknameDialogProps) {
  const [nickname, setNickname] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const trimmed = nickname.trim();
  const valid = nicknameSchema.safeParse(trimmed).success;
  const debounced = useDebouncedValue(trimmed, 300);
  const check = useNicknameCheck(valid ? debounced : "");
  const save = useUpdateChallengeSettings();

  const checked = valid && debounced === trimmed && check.data !== undefined && !check.isFetching;
  const available = trimmed === current || (checked && check.data!.available);
  const hint = !trimmed
    ? "Gib einen Spitznamen ein."
    : !valid
      ? "Nur Buchstaben, Zahlen und _, mindestens 3 Zeichen."
      : available
        ? `„${trimmed}“ ist frei.`
        : checked
          ? `„${trimmed}“ ist leider schon vergeben.`
          : "Wird geprüft …";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!available) return;
    setError(null);
    try {
      if (trimmed !== current) await save.mutateAsync({ nickname: trimmed });
      onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Wähle deinen Spitznamen"
      description="So erscheinst du in globalen Ranglisten und in Duellen mit anderen Teams. Dein echter Name bleibt verborgen."
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <span
          aria-hidden="true"
          className="bg-accent/15 mx-auto flex size-14 items-center justify-center rounded-2xl"
        >
          <UserRound className="text-accent size-7" />
        </span>
        <TextField
          label="Spitzname"
          value={nickname}
          maxLength={20}
          autoComplete="off"
          onChange={(event) => setNickname(event.target.value)}
          hint={
            <span
              aria-live="polite"
              className={cn(available ? "text-accent" : trimmed && checked && "text-danger")}
            >
              {hint}
            </span>
          }
          error={error ?? undefined}
          trailing={
            available ? <Check aria-hidden="true" className="text-accent mr-3 size-5" /> : undefined
          }
        />
        {checked && !available && check.data!.suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted text-xs">Frei:</span>
            {check.data!.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setNickname(suggestion)}
                className="border-border-strong hover:border-text h-8 rounded-full border px-3 text-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <p className="text-muted text-xs">
          3–20 Zeichen: Buchstaben, Zahlen und _. Später in den Einstellungen änderbar.
        </p>
        <Button type="submit" size="lg" disabled={!available} loading={save.isPending}>
          {submitLabel}
        </Button>
      </form>
    </Dialog>
  );
}
