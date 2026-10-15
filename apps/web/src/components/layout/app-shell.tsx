import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { navigation, type NavItem } from "@/app/navigation";
import { useSession } from "@/features/auth/session";
import { cn } from "@/lib/cn";

import { AccountMenu } from "./account-menu";
import { Logo } from "./logo";

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-card px-3 py-2.5 font-medium transition-colors",
          isActive ? "bg-inset text-text" : "text-muted hover:bg-inset hover:text-text",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden="true" className={cn("size-5", isActive && "text-accent")} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex min-w-16 flex-1 flex-col items-center gap-1 rounded-card px-2 py-2 text-xs",
          isActive ? "bg-bg text-text" : "text-muted",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden="true" className={cn("size-6", isActive && "text-accent")} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

/**
 * Grundlayout für angemeldete Nutzer: Seitenleiste ab `lg`, darunter Kopfzeile und
 * Tab-Leiste am unteren Rand (Daumen-Reichweite am Handy).
 */
export function AppShell() {
  const role = useSession((state) => state.user?.role);
  const items = role ? navigation[role] : [];
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);

  // Nach einem Seitenwechsel den Fokus auf den Inhalt setzen, damit Screenreader dort
  // weiterlesen. Vergleich mit dem vorherigen Pfad statt "erster Render", weil StrictMode
  // Effekte doppelt ausführt.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="bg-primary text-on-primary sr-only z-50 rounded-card px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Zum Inhalt springen
      </a>

      <aside className="border-border bg-surface sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r p-4 lg:flex">
        <Logo className="mb-8 px-2" />
        <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <AccountMenu showName />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-bg/90 sticky top-0 z-30 flex h-16 items-center justify-between px-4 backdrop-blur lg:hidden">
          <Logo />
          <AccountMenu />
        </header>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className={cn(
            "mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-8 outline-none lg:px-8 lg:pt-8",
            items.length > 1 && "pb-28 lg:pb-8",
          )}
        >
          <Outlet />
        </main>
      </div>

      {items.length > 1 && (
        <nav
          aria-label="Hauptnavigation"
          className="bg-surface/90 fixed inset-x-0 bottom-0 z-30 flex gap-1 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
        >
          {items.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}
        </nav>
      )}
    </div>
  );
}
