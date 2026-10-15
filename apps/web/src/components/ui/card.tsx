import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("bg-surface rounded-card overflow-hidden", className)} {...props} />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  icon?: LucideIcon;
  /** Tailwind-Textfarbe des Icons, z. B. `text-module-weight` (Farbcode je Modul). */
  iconClassName?: string;
  action?: ReactNode;
  /** Überschriften-Ebene, damit die Dokumentgliederung stimmt. */
  as?: "h2" | "h3";
}

/** Titelzeile mit Modul-Icon. Durch eine Linie in Hintergrundfarbe abgetrennt (wie die alte App). */
export function CardHeader({
  title,
  icon: Icon,
  iconClassName,
  action,
  as: Heading = "h2",
}: CardHeaderProps) {
  return (
    <div className="border-bg flex items-center gap-2 border-b-[2.5px] px-4 py-2.5">
      {Icon && <Icon aria-hidden="true" className={cn("size-5 shrink-0", iconClassName)} />}
      <Heading className="flex-1 text-base font-medium">{title}</Heading>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}
