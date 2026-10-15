import { SearchX } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFoundPage() {
  return (
    <>
      <title>Seite nicht gefunden · AthletePT</title>
      <h1 className="sr-only">Seite nicht gefunden</h1>
      <EmptyState
        icon={SearchX}
        title="Diese Seite gibt es nicht"
        description="Vielleicht hat sich die Adresse geändert oder der Link ist veraltet."
        action={
          <Button asChild>
            <Link to="/">Zur Startseite</Link>
          </Button>
        }
      />
    </>
  );
}
