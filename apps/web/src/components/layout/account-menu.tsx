import { LogOut, Settings, Sparkles } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useNavigate } from "react-router";

import { roleLabel } from "@/app/navigation";
import { logout, useSession } from "@/features/auth/session";
import { openWhatsNew, useHasWhatsNew } from "@/features/whats-new/store";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const itemClasses =
  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-inset";

export function AccountMenu({ showName = false }: { showName?: boolean }) {
  const user = useSession((state) => state.user);
  const navigate = useNavigate();
  const hasWhatsNew = useHasWhatsNew();

  if (!user) return null;

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    navigate("/login", { replace: true });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "hover:bg-inset flex items-center gap-3 rounded-card p-1.5 text-left",
          showName && "w-full",
        )}
      >
        {/* Initialen als CSS-Inhalt: sichtbar, aber nicht Teil des zugänglichen Namens, der damit
            den sichtbaren Text enthält (WCAG 2.5.3). */}
        <span
          aria-hidden="true"
          data-initials={initials(user.name)}
          className="bg-primary text-on-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold before:content-[attr(data-initials)]"
        />
        <span className={cn("min-w-0 flex-1", !showName && "sr-only")}>
          <span className="block truncate text-sm font-medium">
            <span className="sr-only">Konto von </span>
            {user.name}
          </span>
          {showName && <span className="text-muted block text-xs">{roleLabel[user.role]}</span>}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="bg-surface border-border z-50 min-w-56 rounded-card border p-1.5 shadow-xl"
        >
          <DropdownMenu.Label className="px-3 py-2">
            <span className="block text-sm font-medium">{user.name}</span>
            <span className="text-muted block truncate text-xs">{user.email}</span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item className={itemClasses} onSelect={() => navigate("/settings")}>
            <Settings aria-hidden="true" className="size-4" /> Einstellungen
          </DropdownMenu.Item>
          {hasWhatsNew && (
            <DropdownMenu.Item className={itemClasses} onSelect={openWhatsNew}>
              <Sparkles aria-hidden="true" className="size-4" /> Was ist neu?
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className={itemClasses} onSelect={() => void handleLogout()}>
            <LogOut aria-hidden="true" className="size-4" /> Abmelden
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
