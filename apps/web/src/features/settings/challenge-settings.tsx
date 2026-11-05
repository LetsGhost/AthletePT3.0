import { ChevronRight, UserRound } from "lucide-react";
import { useState } from "react";

import { toast } from "@/components/ui/toast-store";
import { useChallengeSettings } from "@/features/challenges/api";
import { NicknameDialog } from "@/features/challenges/nickname-dialog";
import { cn } from "@/lib/cn";

import { RowIcon, RowText, rowClasses } from "./settings-parts";

/** Spitzname für Challenges (nur Athleten). */
export function ChallengeSettings() {
  const settings = useChallengeSettings();
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
