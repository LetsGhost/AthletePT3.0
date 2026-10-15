import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";

import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Rote Bestätigung für destruktive Aktionen. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

/** Bestätigungsdialog mit Fokusfalle und Escape-Unterstützung (Radix AlertDialog). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-overlay fixed inset-0 z-40 backdrop-blur-sm" />
        <AlertDialog.Content className="bg-surface fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-tile p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          {description ? (
            <AlertDialog.Description className="text-muted mt-2 text-sm">
              {description}
            </AlertDialog.Description>
          ) : (
            <AlertDialog.Description className="sr-only">{title}</AlertDialog.Description>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? "danger" : "primary"}
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
