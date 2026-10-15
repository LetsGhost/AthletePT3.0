import { CircleAlert, CircleCheck, X } from "lucide-react";

import { cn } from "@/lib/cn";

import { dismissToast as dismiss, useToasts } from "./toast-store";

export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = t.variant === "success" ? CircleCheck : CircleAlert;
        return (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className="bg-surface border-border pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card border p-3 shadow-lg"
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "size-5 shrink-0",
                t.variant === "success" ? "text-success" : "text-danger",
              )}
            />
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Meldung schließen"
              className="text-muted hover:text-text rounded p-1"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
