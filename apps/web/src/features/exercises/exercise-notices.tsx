import type { ExerciseNotice, UserRole } from "@athletept/shared";
import { X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-store";
import { useSession } from "@/features/auth/session";
import { errorMessage } from "@/lib/http";

import { useDismissNotice, useExerciseNotices } from "./api";

/** Text je Art. Ersetzt hat bei Athleten ihr Coach, bei Coaches der Sysadmin. */
function noticeText(notice: ExerciseNotice, role: UserRole | undefined) {
  const name = notice.exerciseName;
  switch (notice.kind) {
    case "adopted":
      return `Dein Coach hat „${name}“ in seinen Katalog übernommen. Du kannst die Übung weiter verwenden, ändern kann sie jetzt nur dein Coach.`;
    case "published":
      return `„${name}“ ist jetzt im globalen Übungskatalog. Du kannst die Übung weiter verwenden, ändern kann sie jetzt nur der Sysadmin.`;
    case "replaced":
      return role === "athlete"
        ? `Dein Coach hat „${name}“ durch „${notice.replacementName ?? ""}“ ersetzt. Deine Pläne und Trainings verwenden jetzt diese Übung, dein Verlauf läuft dort weiter.`
        : `Der Sysadmin hat „${name}“ durch „${notice.replacementName ?? ""}“ aus dem globalen Katalog ersetzt. Pläne, Vorlagen und Trainings deiner Athleten verwenden jetzt diese Übung.`;
  }
}

/** Hinweise zu übernommenen Übungen, bis sie weggeklickt werden. */
export function ExerciseNotices({ className }: { className?: string }) {
  const notices = useExerciseNotices();
  const dismiss = useDismissNotice();
  const role = useSession((state) => state.user?.role);
  const items = notices.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <ul className={className} aria-label="Hinweise zu Übungen">
      {items.map((notice) => (
        <li key={notice.id} className="mb-2">
          <Alert variant="info">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p>{noticeText(notice, role)}</p>
                {notice.reason && <p className="text-muted mt-1 text-sm">„{notice.reason}“</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Hinweis schließen"
                loading={dismiss.isPending && dismiss.variables === notice.id}
                onClick={() =>
                  dismiss.mutate(notice.id, {
                    onError: (error) => toast(errorMessage(error), "error"),
                  })
                }
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </Alert>
        </li>
      ))}
    </ul>
  );
}
