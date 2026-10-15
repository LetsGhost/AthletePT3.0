import { IS_BETA } from "@/app/release";
import { cn } from "@/lib/cn";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <img src="/app-icon.svg" alt="" className="size-8 rounded-lg" />
      {withText && <span className="text-lg tracking-wide">AthletePT</span>}
      {withText && IS_BETA && (
        <span className="border-accent text-accent rounded-full border px-2 py-0.5 text-xs font-medium">
          Beta
        </span>
      )}
    </span>
  );
}
