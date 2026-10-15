import { cn } from "@/lib/cn";

interface ProgressProps {
  value: number;
  max: number;
  label: string;
  className?: string;
}

export function Progress({ value, max, label, className }: ProgressProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("bg-inset h-2 overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          percent >= 100 ? "bg-warning" : "bg-accent",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
