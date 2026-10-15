import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { useRouteError } from "react-router";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Fängt unerwartete Render-Fehler ab, statt eine weiße Seite zu zeigen. */
export function RouteErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    // Bewusst in der Konsole lassen: einzige Spur bei Fehlern im Browser des Nutzers.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <title>Fehler · AthletePT</title>
      <h1 className="sr-only">Unerwarteter Fehler</h1>
      <EmptyState
        icon={TriangleAlert}
        title="Hier ist leider etwas schiefgelaufen"
        description="Lade die Seite neu. Wenn der Fehler bleibt, melde dich bitte bei uns."
        action={<Button onClick={() => window.location.reload()}>Seite neu laden</Button>}
      />
    </main>
  );
}
