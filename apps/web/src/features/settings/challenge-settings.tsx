import { ChevronRight, Mail, UserRound } from "lucide-react";
import { useId, useState } from "react";

import { toast } from "@/components/ui/toast-store";
import { useChallengeSettings, useUpdateChallengeSettings } from "@/features/challenges/api";
import { NicknameDialog } from "@/features/challenges/nickname-dialog";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/http";

import { RowIcon, RowText, rowClasses, Switch } from "./settings-parts";

/** Spitzname und Mails zu Challenges (nur Athleten). */
export function ChallengeSettings() {
  const id = useId();
  const settings = useChallengeSettings();
  const update = useUpdateChallengeSettings();
  const [editing, setEditing] = useState(false);
  const data = settings.data;

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(rowClasses, "hover:bg-inset/50")}
      >
        <RowIcon icon={UserRound} className="bg-challenge-system/15 text-challenge-system" />
        <RowText title="Spitzname" sub="Für globale Ranglisten und Duelle mit anderen Teams" />
        <span className="text-muted text-sm">{data?.nickname ?? "Nicht gesetzt"}</span>
        <ChevronRight aria-hidden="true" className="text-muted size-4" />
      </button>
      <div className={rowClasses}>
        <RowIcon icon={Mail} className="bg-challenge-duel/15 text-challenge-duel" />
        <RowText
          id={`${id}-mails`}
          title="E-Mails zu Challenges"
          sub="Einladungen, neue Challenges und Ergebnisse"
        />
        <Switch
          checked={data?.challengeMails ?? true}
          labelledBy={`${id}-mails`}
          onChange={(challengeMails) =>
            update.mutate(
              { challengeMails },
              { onError: (error) => toast(errorMessage(error), "error") },
            )
          }
        />
      </div>
      {editing && (
        <NicknameDialog
          open
          onOpenChange={setEditing}
          current={data?.nickname ?? null}
          onSaved={() => {
            setEditing(false);
            toast("Spitzname gespeichert.");
          }}
        />
      )}
    </>
  );
}
