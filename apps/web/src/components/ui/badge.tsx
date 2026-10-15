import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const tones = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-muted",
} as const;

/** Status-Kennzeichnung. Die Farbe steckt im Punkt, der Text bleibt in Textfarbe (Kontrast). */
export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className="bg-inset inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
      <span aria-hidden="true" className={cn("size-2 rounded-full", tones[tone])} />
      {children}
    </span>
  );
}
