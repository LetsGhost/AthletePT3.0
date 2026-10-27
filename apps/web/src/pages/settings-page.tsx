import { ChevronRight, KeyRound, LogOut, PlugZap } from "lucide-react";
import { useState } from "react";

import { roleLabel } from "@/app/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { useMyApiKeys } from "@/features/api-keys/api";
import { MyApiKeys } from "@/features/api-keys/my-api-keys";
import { useSession } from "@/features/auth/session";
import { useLogout } from "@/features/auth/use-logout";
import { ChangePasswordForm } from "@/features/settings/change-password-form";
import { RestTimerSettings } from "@/features/settings/rest-timer-settings";
import { RowIcon, RowText, rowClasses, SettingsGroup } from "@/features/settings/settings-parts";
import { ThemePicker } from "@/features/settings/theme-picker";
import { openWhatsNew, useHasWhatsNew } from "@/features/whats-new/store";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const linkRowClasses = cn(rowClasses, "hover:bg-inset/50");

function ConnectedAppsRow({ onOpen }: { onOpen: () => void }) {
  const apiKeys = useMyApiKeys();
  const connected = apiKeys.data?.filter(
    (apiKey) => apiKey.status === "active" || apiKey.status === "pending",
  ).length;

  return (
    <button type="button" onClick={onOpen} className={linkRowClasses}>
      <RowIcon icon={PlugZap} className="bg-module-records/15 text-module-records" />
      <RowText title="Verbundene Apps" />
      {connected !== undefined && (
        <span className="text-muted text-sm">{connected === 0 ? "Keine" : connected}</span>
      )}
      <ChevronRight aria-hidden="true" className="text-muted size-4" />
    </button>
  );
}

export default function SettingsPage() {
  const user = useSession((state) => state.user);
  const hasWhatsNew = useHasWhatsNew();
  const [dialog, setDialog] = useState<"password" | "apps" | null>(null);
  const handleLogout = useLogout();
  if (!user) return null;

  const closeDialog = (open: boolean) => !open && setDialog(null);

  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="flex max-w-xl flex-col gap-5">
        <section
          aria-label="Profil"
          className="bg-surface flex items-center gap-3.5 rounded-tile p-4"
        >
          <span
            aria-hidden="true"
            className="bg-primary text-on-primary flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
          >
            {initials(user.name)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-lg font-semibold">{user.name}</span>
            <span className="text-muted truncate text-sm">{user.email}</span>
          </span>
          <span className="bg-accent/12 text-accent shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {roleLabel[user.role]}
          </span>
        </section>

        <SettingsGroup title="Darstellung">
          <ThemePicker />
        </SettingsGroup>

        {user.role === "athlete" && (
          <SettingsGroup
            title="Training"
            footer="Die Pausenvorgabe deines Coaches hat immer Vorrang. Diese Einstellungen gelten nur für dieses Gerät."
          >
            <RestTimerSettings />
          </SettingsGroup>
        )}

        <SettingsGroup title="Konto">
          <button type="button" onClick={() => setDialog("password")} className={linkRowClasses}>
            <RowIcon icon={KeyRound} className="bg-module-checkin/15 text-module-checkin" />
            <RowText title="Passwort ändern" />
            <ChevronRight aria-hidden="true" className="text-muted size-4" />
          </button>
          {user.role !== "sysadmin" && <ConnectedAppsRow onOpen={() => setDialog("apps")} />}
        </SettingsGroup>

        {hasWhatsNew && (
          <SettingsGroup title="Über">
            <button type="button" onClick={openWhatsNew} className={linkRowClasses}>
              <RowText title="Was ist neu" />
              <span className="bg-accent text-bg rounded px-1.5 text-[10px] font-bold">NEU</span>
              <ChevronRight aria-hidden="true" className="text-muted size-4" />
            </button>
          </SettingsGroup>
        )}

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="border-border-strong text-danger hover:bg-surface flex h-12 items-center justify-center gap-2 rounded-tile border font-medium"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Abmelden
        </button>
      </div>

      <Dialog open={dialog === "password"} onOpenChange={closeDialog} title="Passwort ändern">
        <ChangePasswordForm onDone={() => setDialog(null)} />
      </Dialog>
      <Dialog open={dialog === "apps"} onOpenChange={closeDialog} title="Verbundene Apps">
        <MyApiKeys />
      </Dialog>
    </>
  );
}
