import type { AthleteDetail } from "@athletept/shared";
import { Archive, ArrowLeft, ClipboardList, Mail, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryState } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import {
  useArchiveAthlete,
  useAthlete,
  useDeleteAthlete,
  useReactivateAthlete,
  useResendAthleteInvitation,
  useUpdateAthlete,
} from "@/features/athletes/api";
import { AthleteForm } from "@/features/athletes/athlete-form";
import { ProfileSummary } from "@/features/athletes/profile-summary";
import { PlansCard } from "@/features/plans/plans-card";
import { AthleteProgressCard } from "@/features/stats/progress-card";
import { AthleteWeekCard, AthleteWorkoutsCard } from "@/features/workouts/athlete-training-cards";
import { StatusBadge } from "@/features/users/status-badge";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/http";

function withToast<T>(run: () => Promise<T>, success: (result: T) => string) {
  return async () => {
    try {
      toast(success(await run()));
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };
}

function AthleteActions({ athlete }: { athlete: AthleteDetail }) {
  const navigate = useNavigate();
  const resend = useResendAthleteInvitation(athlete.id);
  const archive = useArchiveAthlete(athlete.id);
  const reactivate = useReactivateAthlete(athlete.id);
  const remove = useDeleteAthlete(athlete.id);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const handleResend = withToast(
    () => resend.mutateAsync(),
    ({ inviteSent }) =>
      inviteSent
        ? `Neue Einladung an ${athlete.email} verschickt.`
        : "Die Mail konnte nicht verschickt werden.",
  );
  const handleReactivate = withToast(
    () => reactivate.mutateAsync(undefined),
    (a) =>
      a.status === "invited"
        ? "Reaktiviert. Eine neue Einladung ist unterwegs."
        : "Athlet reaktiviert.",
  );

  return (
    <Card>
      <CardHeader title="Zugang" icon={Mail} iconClassName="text-module-checkin" />
      <CardBody className="flex flex-col gap-4">
        {athlete.status === "invited" && (
          <Alert variant="info">
            {athlete.name} hat die Einladung noch nicht angenommen. Der Link ist 7 Tage gültig.
          </Alert>
        )}
        {athlete.status === "disabled" && (
          <Alert variant="info">
            Archiviert: kein Zugang, belegt keinen Platz im Kontingent. Alle Daten bleiben erhalten.
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {athlete.status === "invited" && (
            <Button
              variant="secondary"
              loading={resend.isPending}
              onClick={() => void handleResend()}
            >
              <Mail aria-hidden="true" className="size-4" /> Einladung erneut senden
            </Button>
          )}
          {athlete.status === "disabled" ? (
            <Button
              variant="secondary"
              loading={reactivate.isPending}
              onClick={() => void handleReactivate()}
            >
              <RotateCcw aria-hidden="true" className="size-4" /> Reaktivieren
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirm("archive")}>
              <Archive aria-hidden="true" className="size-4" /> Archivieren
            </Button>
          )}
          <Button variant="ghost" className="text-danger" onClick={() => setConfirm("delete")}>
            <Trash2 aria-hidden="true" className="size-4" /> Endgültig löschen
          </Button>
        </div>
      </CardBody>

      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`${athlete.name} archivieren?`}
        description="Der Zugang wird gesperrt und der Platz im Kontingent frei. Du kannst den Athleten jederzeit reaktivieren."
        confirmLabel="Archivieren"
        loading={archive.isPending}
        onConfirm={() =>
          void archive
            .mutateAsync(undefined)
            .then(() => toast(`${athlete.name} archiviert.`))
            .catch((error: unknown) => toast(errorMessage(error), "error"))
            .finally(() => setConfirm(null))
        }
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`${athlete.name} endgültig löschen?`}
        description="Alle Daten (Anamnese, Trainingspläne und Trainingsprotokolle) werden unwiderruflich gelöscht. Wenn du nur den Zugang sperren willst, archiviere stattdessen."
        confirmLabel="Endgültig löschen"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          void remove
            .mutateAsync()
            .then(() => {
              toast(`${athlete.name} wurde gelöscht.`);
              navigate("/coach/athletes", { replace: true });
            })
            .catch((error: unknown) => {
              toast(errorMessage(error), "error");
              setConfirm(null);
            })
        }
      />
    </Card>
  );
}

function ProfileCard({ athlete }: { athlete: AthleteDetail }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateAthlete(athlete.id);

  return (
    <Card>
      <CardHeader
        title="Anamnese"
        icon={ClipboardList}
        iconClassName="text-accent"
        action={
          !editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" className="size-4" /> Bearbeiten
            </Button>
          )
        }
      />
      <CardBody>
        {editing ? (
          <AthleteForm
            mode="edit"
            defaultValues={{ name: athlete.name, profile: athlete.profile }}
            submitLabel="Speichern"
            onCancel={() => setEditing(false)}
            onSubmit={async ({ name, profile }) => {
              await update.mutateAsync({ name, profile });
              toast("Änderungen gespeichert.");
              setEditing(false);
            }}
          />
        ) : (
          <ProfileSummary profile={athlete.profile} />
        )}
      </CardBody>
    </Card>
  );
}

export default function AthleteDetailPage() {
  const { id = "" } = useParams();
  const athlete = useAthlete(id);

  return (
    <>
      <Link
        to="/coach/athletes"
        className="text-muted hover:text-text mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Athleten
      </Link>
      <QueryState query={athlete} loading={<div className="skeleton h-64 rounded-card" />}>
        {(data) => (
          <>
            <PageHeader
              title={data.name}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={data.status} disabledLabel="Archiviert" />
                  <span className="break-all">{data.email}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {data.lastLoginAt
                      ? `zuletzt aktiv ${formatDate(data.lastLoginAt)}`
                      : `eingeladen am ${formatDate(data.createdAt)}`}
                  </span>
                </span>
              }
            />
            <div className="flex flex-col gap-4">
              <AthleteWeekCard athleteId={data.id} athleteName={data.name} />
              <AthleteWorkoutsCard athleteId={data.id} athleteName={data.name} />
              <AthleteProgressCard athleteId={data.id} athleteName={data.name} />
              <PlansCard athleteId={data.id} athleteName={data.name} />
              <ProfileCard athlete={data} />
              <AthleteActions athlete={data} />
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
