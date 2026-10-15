import { planTypeLabels, type PlanType } from "@athletept/shared";

import { cn } from "@/lib/cn";

/** Erkannter Schwerpunkt, z. B. „Unterkörper“. */
export function PlanTypeBadge({ type, className }: { type: PlanType; className?: string }) {
  return (
    <span
      className={cn(
        "border-border-strong inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <span className="sr-only">Schwerpunkt: </span>
      {planTypeLabels[type]}
    </span>
  );
}
