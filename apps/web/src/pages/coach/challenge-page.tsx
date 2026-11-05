import type { ChallengeDetail } from "@athletept/shared";
import { ArrowLeft, Flag, Pencil, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { toast } from "@/components/ui/toast-store";
import {
  useCoachChallenge,
  useDeleteChallenge,
  useEndChallenge,
  useUpdateChallenge,
} from "@/features/challenges/api";
import {
  ChallengeHero,
  ChallengePrize,
  ChallengeRules,
  ChallengeStandings,
} from "@/features/challenges/challenge-detail";
import { errorMessage } from "@/lib/http";

function EditDialog({
  challenge,
  open,
  onOpenChange,
}: {
  challenge: ChallengeDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useUpdateChallenge(challenge.id);
  const [title, setTitle] = useState(challenge.title);
  const [prize, setPrize] = useState(challenge.prize ?? "");
  const [description, setDescription] = useState(challenge.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await save.mutateAsync({ title, prize: prize || null, description: description || null });
      toast("Challenge gespeichert.");
      onOpenChange(false);
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Challenge bearbeiten"
      description="Zeitraum, Ziel und Teilnehmer stehen nach dem Start fest."
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <TextField
          label="Titel"
          value={title}
          maxLength={60}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          label="Preis (optional)"
          value={prize}
          maxLength={120}
          onChange={(event) => setPrize(event.target.value)}
        />
        <TextareaField
          label="Nachricht an die Athleten (optional)"
          rows={3}
          value={description}
          maxLength={500}
          onChange={(event) => setDescription(event.target.value)}
        />
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" loading={save.isPending}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Actions({ challenge }: { challenge: ChallengeDetail }) {
  const navigate = useNavigate();
  const end = useEndChallenge(challenge.id);
  const remove = useDeleteChallenge(challenge.id);
  const [dialog, setDialog] = useState<"edit" | "end" | "delete" | null>(null);
  if (challenge.status === "finished") return null;

  const close = (open: boolean) => !open && setDialog(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => setDialog("edit")}>
        <Pencil aria-hidden="true" className="size-4" /> Bearbeiten
      </Button>
      {challenge.status === "running" ? (
        <Button variant="secondary" size="sm" onClick={() => setDialog("end")}>
          <Flag aria-hidden="true" className="size-4" /> Vorzeitig beenden
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setDialog("delete")}>
          <Trash2 aria-hidden="true" className="size-4" /> Löschen
        </Button>
      )}
      {dialog === "edit" && <EditDialog challenge={challenge} open onOpenChange={close} />}
      <ConfirmDialog
        open={dialog === "end"}
        onOpenChange={close}
        title="Challenge vorzeitig beenden?"
        description="Gewertet wird bis einschließlich heute. Das lässt sich nicht rückgängig machen."
        confirmLabel="Beenden"
        destructive
        loading={end.isPending}
        onConfirm={() =>
          end.mutate(undefined, {
            onSuccess: () => {
              toast("Challenge beendet.");
              setDialog(null);
            },
            onError: (error) => toast(errorMessage(error), "error"),
          })
        }
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={close}
        title="Challenge löschen?"
        description="Die Challenge hat noch nicht begonnen. Deine Athleten sehen sie danach nicht mehr."
        confirmLabel="Löschen"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast("Challenge gelöscht.");
              void navigate("/coach/challenges");
            },
            onError: (error) => toast(errorMessage(error), "error"),
          })
        }
      />
    </div>
  );
}

export default function CoachChallengePage() {
  const { challengeId = "" } = useParams();
  const challenge = useCoachChallenge(challengeId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3.5">
      <Link to="/coach/challenges" className="text-muted inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft aria-hidden="true" className="size-4" /> Challenges
      </Link>
      <QueryState query={challenge} loading={<SkeletonList rows={3} className="h-36" />}>
        {(data) => (
          <>
            <title>{`${data.title} · AthletePT`}</title>
            <ChallengeHero challenge={data} />
            <Actions challenge={data} />
            <ChallengePrize challenge={data} />
            <ChallengeStandings challenge={data} />
            <ChallengeRules challenge={data} />
          </>
        )}
      </QueryState>
    </div>
  );
}
