import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div className="bg-inset rounded-full p-4">
        <Icon aria-hidden="true" className="text-muted size-8" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="text-muted max-w-sm text-sm">{description}</p>}
      {action}
    </div>
  );
}
