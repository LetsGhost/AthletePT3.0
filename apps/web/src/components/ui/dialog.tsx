import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Modaler Dialog mit Fokusfalle, Escape und Schließen-Button (Radix Dialog). */
export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-overlay fixed inset-0 z-40 backdrop-blur-sm" />
        <RadixDialog.Content className="bg-surface fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-tile p-6 shadow-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-tile">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-muted mt-1 text-sm">
                  {description}
                </RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              className="text-muted hover:text-text hover:bg-inset -mt-1 -mr-2 rounded-card p-2"
              aria-label="Schließen"
            >
              <X aria-hidden="true" className="size-5" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
