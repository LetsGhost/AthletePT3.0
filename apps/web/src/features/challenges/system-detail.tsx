import { badgeTierLabels, badgeTiers, type ChallengeDetail } from "@athletept/shared";
import { Globe, Medal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast-store";
import { cn } from "@/lib/cn";
import { ApiError, errorMessage } from "@/lib/http";

import { useChallengeSettings, useJoinChallenge, useLeaveChallenge } from "./api";
import { formatScore } from "./format";
import { NicknameDialog } from "./nickname-dialog";
import { tierTone } from "./tones";

/** Bronze, Silber, Gold mit Schwellen; erreichte Stufen hervorgehoben. */
export function SystemTiers({ challenge }: { challenge: ChallengeDetail }) {
  if (!challenge.tiers) return null;
  const reached = challenge.me?.tier ? badgeTiers.indexOf(challenge.me.tier) : -1;
  return (
    <section aria-labelledby="system-tiers" className="flex flex-col gap-2">
      <h2 id="system-tiers" className="px-0.5 font-semibold">
        Abzeichen-Stufen
      </h2>
      <ol className="grid grid-cols-3 gap-2">
        {badgeTiers.map((tier, index) => (
          <li
            key={tier}
            className={cn(
              "bg-surface flex flex-col items-center gap-1 rounded-tile border p-3 text-center",
              index <= reached ? "border-challenge-coach/40" : "border-transparent",
            )}
          >
            <Medal
              aria-hidden="true"
              className={cn("size-6", index <= reached ? tierTone[tier] : "text-border-strong")}
            />
            <span className="text-xs font-semibold">{badgeTierLabels[tier]}</span>
            <span className="text-muted text-xs">
              ab {formatScore(challenge.metric, challenge.tiers![index]!)}
            </span>
            {index <= reached && <span className="sr-only">erreicht</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Beitreten (mit Spitzname beim ersten Mal) bzw. Verlassen. */
export function SystemMembership({ challenge }: { challenge: ChallengeDetail }) {
  const settings = useChallengeSettings();
  const join = useJoinChallenge(challenge.id);
  const leave = useLeaveChallenge(challenge.id);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (challenge.status === "finished") return null;

  const doJoin = () =>
    join.mutate(undefined, {
      onSuccess: () => toast("Du bist dabei. Viel Erfolg!"),
      onError: (error) => {
        if (error instanceof ApiError && error.code === "nickname_required") setNicknameOpen(true);
        else toast(errorMessage(error), "error");
      },
    });

  if (!challenge.joined) {
    return (
      <>
        <Button
          size="lg"
          loading={join.isPending}
          onClick={() => (settings.data?.nickname ? doJoin() : setNicknameOpen(true))}
        >
          <Globe aria-hidden="true" className="size-5" /> Beitreten
        </Button>
        {nicknameOpen && (
          <NicknameDialog
            open
            onOpenChange={setNicknameOpen}
            submitLabel="Beitreten"
            onSaved={() => {
              setNicknameOpen(false);
              doJoin();
            }}
          />
        )}
      </>
    );
  }
  return (
    <>
      <Button variant="secondary" className="text-danger" onClick={() => setConfirmLeave(true)}>
        Challenge verlassen
      </Button>
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Challenge verlassen?"
        description="Du verschwindest aus der Rangliste. Du kannst wieder beitreten, solange die Challenge läuft."
        confirmLabel="Verlassen"
        destructive
        loading={leave.isPending}
        onConfirm={() =>
          leave.mutate(undefined, {
            onSuccess: () => setConfirmLeave(false),
            onError: (error) => toast(errorMessage(error), "error"),
          })
        }
      />
    </>
  );
}
