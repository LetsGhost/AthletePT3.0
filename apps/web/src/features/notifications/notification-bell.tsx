import { Bell } from "lucide-react";
import { NavLink } from "react-router";

import { useSession } from "@/features/auth/session";
import { cn } from "@/lib/cn";

import { useNotifications } from "./api";

/** Glocke mit Zähler. Bisher bekommen nur Athleten Benachrichtigungen. */
export function NotificationBell({ withLabel = false }: { withLabel?: boolean }) {
  const isAthlete = useSession((state) => state.user?.role === "athlete");
  const notifications = useNotifications({ enabled: isAthlete });
  if (!isAthlete) return null;
  const unread = notifications.data?.unreadCount ?? 0;
  const label = unread > 0 ? `Benachrichtigungen, ${unread} neu` : "Benachrichtigungen";

  return (
    <NavLink
      to="/benachrichtigungen"
      aria-label={withLabel ? undefined : label}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-card font-medium transition-colors",
          withLabel ? "px-3 py-2.5" : "size-10 justify-center",
          isActive ? "bg-inset text-text" : "text-muted hover:bg-inset hover:text-text",
        )
      }
    >
      <span className="relative">
        <Bell aria-hidden="true" className="size-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="bg-danger border-bg absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 px-1 text-[10px] font-bold text-white dark:text-bg"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </span>
      {withLabel && (
        <>
          Benachrichtigungen
          {unread > 0 && <span className="sr-only">, {unread} neu</span>}
        </>
      )}
    </NavLink>
  );
}
