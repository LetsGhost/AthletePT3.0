import type { ExerciseNotice } from "@athletept/shared";
import { X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-store";
import { errorMessage } from "@/lib/http";

import { useDismissNotice, useExerciseNotices } from "./api";

const texts: Record<ExerciseNotice["kind"], (name: string) => string> = {
  adopted: (name) =>
    `Dein Coach hat „${name}“ in seinen Katalog übernommen. Du kannst die Übung weiter verwenden, ändern kann sie jetzt nur dein Coach.`,
  published: (name) =>
    `„${name}“ ist jetzt im globalen Übungskatalog. Du kannst die Übung weiter verwenden, ändern kann sie jetzt nur der Sysadmin.`,
};

/** Hinweise zu übernommenen Übungen, bis sie weggeklickt werden. */
export function ExerciseNotices({ className }: { className?: string }) {
  const notices = useExerciseNotices();
  const dismiss = useDismissNotice();
  const items = notices.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <ul className={className} aria-label="Hinweise zu Übungen">
      {items.map((notice) => (
        <li key={notice.id} className="mb-2">
          <Alert variant="info">
            <div className="flex items-start justify-between gap-2">
              <p>{texts[notice.kind](notice.exerciseName)}</p>
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
