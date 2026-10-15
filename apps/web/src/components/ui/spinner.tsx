import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={cn("size-5 animate-spin", className)} />;
}

/** Ganzseitiger Ladezustand mit Ansage für Screenreader. */
export function PageSpinner({ label = "Wird geladen …" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[50dvh] flex-col items-center justify-center gap-3">
      <Spinner className="size-8 text-accent" />
      <span className="text-muted text-sm">{label}</span>
    </div>
  );
}
