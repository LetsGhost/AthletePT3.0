import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/** Seitenüberschrift. Setzt auch den Tab-Titel (React 19 hebt <title> in den <head>). */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <title>{`${title} · AthletePT`}</title>
      <div>
        <h1 className="text-2xl font-medium sm:text-3xl">{title}</h1>
        {description && <p className="text-muted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
