import { cn } from "@/lib/cn";

/** Gemeinsames Aussehen aller Eingabefelder (Text, Zahl, Select, Textarea). */
export const inputClasses = cn(
  "h-11 w-full rounded-card border border-border-strong bg-inset px-3 text-text",
  "placeholder:text-muted aria-[invalid=true]:border-danger",
  "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent",
);
