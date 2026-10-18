import { ArrowLeft, FileDown } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { toast } from "@/components/ui/toast-store";
import { useCreateAthlete } from "@/features/athletes/api";
import { AthleteForm } from "@/features/athletes/athlete-form";

export default function NewAthletePage() {
  const createAthlete = useCreateAthlete();
  const navigate = useNavigate();

  return (
    <>
      <Link
        to="/coach/athletes"
        className="text-muted hover:text-text mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Athleten
      </Link>
      <PageHeader
        title="Athlet einladen"
        description="Der Athlet bekommt eine Mail und legt dort sein Passwort fest. Die Anamnese kannst du auch später ergänzen."
        actions={
          <Button variant="secondary" asChild>
            <a href="/coach/fragebogen" target="_blank" rel="noopener">
              <FileDown aria-hidden="true" className="size-4" /> Fragebogen als PDF
            </a>
          </Button>
        }
      />
      <Card>
        <CardBody className="sm:p-6">
          <AthleteForm
            mode="create"
            submitLabel="Einladen"
            onCancel={() => navigate("/coach/athletes")}
            onSubmit={async ({ name, email, profile }) => {
              const athlete = await createAthlete.mutateAsync({ name, email: email!, profile });
              toast(
                athlete.inviteSent
                  ? `Einladung an ${athlete.email} verschickt.`
                  : "Athlet angelegt, aber die Mail konnte nicht verschickt werden. Bitte erneut senden.",
                athlete.inviteSent ? "success" : "error",
              );
              navigate(`/coach/athletes/${athlete.id}`, { replace: true });
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
