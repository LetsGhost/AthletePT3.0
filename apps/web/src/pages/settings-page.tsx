import { KeyRound, Palette, Timer, UserRound } from "lucide-react";

import { roleLabel } from "@/app/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useSession } from "@/features/auth/session";
import { ChangePasswordForm } from "@/features/settings/change-password-form";
import { RestTimerSettings } from "@/features/settings/rest-timer-settings";
import { ThemePicker } from "@/features/settings/theme-picker";

export default function SettingsPage() {
  const user = useSession((state) => state.user);
  if (!user) return null;

  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Profil" icon={UserRound} iconClassName="text-accent" />
          <CardBody>
            <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted text-sm">Name</dt>
              <dd>{user.name}</dd>
              <dt className="text-muted text-sm">E-Mail</dt>
              <dd className="break-all">{user.email}</dd>
              <dt className="text-muted text-sm">Rolle</dt>
              <dd>{roleLabel[user.role]}</dd>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Darstellung" icon={Palette} iconClassName="text-module-records" />
          <CardBody>
            <ThemePicker />
          </CardBody>
        </Card>

        {user.role === "athlete" && (
          <Card>
            <CardHeader title="Training" icon={Timer} iconClassName="text-module-week" />
            <CardBody>
              <RestTimerSettings />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Passwort ändern" icon={KeyRound} iconClassName="text-module-checkin" />
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
