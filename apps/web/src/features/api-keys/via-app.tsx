import type { WriteSource } from "@athletept/shared";
import { PlugZap } from "lucide-react";

import { viaAppText } from "./labels";

/** Dezenter Hinweis, dass die letzte Änderung aus einer externen App kam. */
export function ViaApp({ source }: { source: WriteSource }) {
  if (!source) return null;
  return (
    <span className="text-muted inline-flex items-center gap-1 text-sm">
      <PlugZap aria-hidden="true" className="size-4" />
      Zuletzt geändert {viaAppText(source)}
    </span>
  );
}
