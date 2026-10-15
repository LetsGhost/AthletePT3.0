import type { UserRole } from "@athletept/shared";
import { Navigate, Outlet, useLocation } from "react-router";

import { PageSpinner } from "@/components/ui/spinner";
import { useSession } from "@/features/auth/session";

import { homePath } from "./navigation";

/** Nur für angemeldete Nutzer. Merkt sich das Ziel, um nach dem Login dorthin zurückzukehren. */
export function RequireAuth() {
  const status = useSession((state) => state.status);
  const location = useLocation();

  if (status === "loading") return <PageSpinner label="Sitzung wird geprüft …" />;
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Nur für die angegebenen Rollen. Andere landen auf ihrer eigenen Startseite. */
export function RequireRole({ roles }: { roles: readonly UserRole[] }) {
  const role = useSession((state) => state.user?.role);
  if (!role) return null;
  if (!roles.includes(role)) return <Navigate to={homePath[role]} replace />;
  return <Outlet />;
}

/**
 * Für Login & Co.: Angemeldete Nutzer werden weitergeleitet, nach dem Login also
 * automatisch zur ursprünglich aufgerufenen Seite oder zur Startseite ihrer Rolle.
 */
export function PublicOnly() {
  const { status, user } = useSession();
  const location = useLocation();
  if (status === "loading") return <PageSpinner />;
  if (status === "authenticated" && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homePath[user.role]} replace />;
  }
  return <Outlet />;
}

export function HomeRedirect() {
  const user = useSession((state) => state.user);
  return <Navigate to={user ? homePath[user.role] : "/login"} replace />;
}

/** Umbenannte Pfade: alte Links (z. B. Lesezeichen) auf den neuen Pfad umleiten. */
export function RenamedPath({ from, to }: { from: string; to: string }) {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(from, to) + search} replace />;
}
