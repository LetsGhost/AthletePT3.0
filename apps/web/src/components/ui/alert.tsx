import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const styles = {
  error: { icon: CircleAlert, className: "border-danger text-danger" },
  success: { icon: CircleCheck, className: "border-success text-success" },
  info: { icon: Info, className: "border-accent text-accent" },
  warning: { icon: TriangleAlert, className: "border-warning text-warning" },
} as const;

interface AlertProps {
  variant?: keyof typeof styles;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Inline-Meldung. Fehler werden sofort angesagt (role="alert"), alles andere höflich. */
export function Alert({ variant = "info", title, children, className }: AlertProps) {
  const { icon: Icon, className: variantClass } = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("bg-inset flex gap-3 rounded-card border-l-4 p-3", variantClass, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="text-text text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
