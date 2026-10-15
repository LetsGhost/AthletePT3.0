import type { ReactNode } from "react";
import { Link } from "react-router";

import { IS_BETA } from "@/app/release";

import { Logo } from "./logo";

interface AuthCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Rahmen für Login, Einladung und Passwort-Reset. */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10">
      <title>{`${title} · AthletePT`}</title>
      <div className="bg-surface relative w-full max-w-sm overflow-hidden rounded-tile p-8 shadow-xl">
        {/* Petrol-Fläche als Wiedererkennungsmerkmal der alten App */}
        <div
          aria-hidden="true"
          className="bg-primary absolute -top-24 -right-24 size-56 rotate-[36deg] rounded-[2rem] opacity-60"
        />
        <div className="relative">
          <Logo className="mb-8" />
          <h1 className="mb-1 text-2xl font-medium">{title}</h1>
          {description && <p className="text-muted mb-6 text-sm">{description}</p>}
          {children}
        </div>
      </div>
      {IS_BETA && (
        <p className="text-muted max-w-sm text-center text-sm">
          AthletePT ist in einer geschlossenen Beta. Zugang gibt es nur mit Einladung, und es kann
          noch Fehler geben.
        </p>
      )}
      <Link
        to="/datenschutz"
        className="text-muted hover:text-text text-sm underline-offset-4 hover:underline"
      >
        Datenschutz
      </Link>
    </main>
  );
}
