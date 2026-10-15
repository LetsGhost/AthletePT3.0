import type { Coach } from "@athletept/shared";
import { Mail, Pencil, UserPlus, Users } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import { useCoaches, useResendCoachInvitation } from "@/features/coaches/api";
import { EditCoachDialog, InviteCoachDialog } from "@/features/coaches/coach-form-dialog";
import { StatusBadge } from "@/features/users/status-badge";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/http";

function CoachRow({ coach, onEdit }: { coach: Coach; onEdit: () => void }) {
  const resend = useResendCoachInvitation();

  const handleResend = async () => {
    try {
      const { inviteSent } = await resend.mutateAsync(coach.id);
      toast(
        inviteSent
          ? `Neue Einladung an ${coach.email} verschickt.`
          : "Die Mail konnte nicht verschickt werden.",
        inviteSent ? "success" : "error",
      );
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <li>
      <Card className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{coach.name}</p>
            <StatusBadge status={coach.status} />
          </div>
          <p className="text-muted truncate text-sm">{coach.email}</p>
        </div>
        <div className="md:w-48">
          <p className="mb-1 text-sm">
            {coach.athleteCount} von {coach.athleteQuota} Athleten
          </p>
          <Progress
            value={coach.athleteCount}
            max={coach.athleteQuota}
            label={`Kontingent von ${coach.name}`}
          />
        </div>
        <p className="text-muted text-sm md:w-40">
          {coach.lastLoginAt
            ? `Zuletzt aktiv ${formatDate(coach.lastLoginAt)}`
            : "Noch nie angemeldet"}
        </p>
        <div className="flex gap-2">
          {coach.status === "invited" && (
            <Button
              variant="secondary"
              size="sm"
              loading={resend.isPending}
              onClick={() => void handleResend()}
            >
              <Mail aria-hidden="true" className="size-4" /> Erneut einladen
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label={`${coach.name} bearbeiten`}
          >
            <Pencil aria-hidden="true" className="size-4" /> Bearbeiten
          </Button>
        </div>
      </Card>
    </li>
  );
}

export default function CoachesPage() {
  const coaches = useCoaches();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);

  return (
    <>
      <PageHeader
        title="Coaches"
        description="Lade Coaches ein und lege fest, wie viele Athleten sie betreuen dürfen."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden="true" className="size-5" /> Coach einladen
          </Button>
        }
      />

      <QueryState query={coaches} loading={<SkeletonList />}>
        {(list) =>
          list.length === 0 ? (
            <Card>
              <EmptyState
                icon={Users}
                title="Noch keine Coaches"
                description="Lade den ersten Coach ein. Er bekommt eine Mail und legt dort sein Passwort fest."
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((coach) => (
                <CoachRow key={coach.id} coach={coach} onEdit={() => setEditing(coach)} />
              ))}
            </ul>
          )
        }
      </QueryState>

      <InviteCoachDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      {editing && (
        <EditCoachDialog coach={editing} open onOpenChange={(open) => !open && setEditing(null)} />
      )}
    </>
  );
}
