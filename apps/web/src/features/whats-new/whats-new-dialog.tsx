import { Sparkles, X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { useState, type KeyboardEvent } from "react";
import { useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session";
import { cn } from "@/lib/cn";

import { PreviewIcon } from "./preview-kit";
import { releaseNotes } from "./release-notes";
import {
  markReleaseSeen,
  openWhatsNew,
  releaseFor,
  useSeenRelease,
  useWhatsNewDialog,
} from "./store";
import type { WhatsNewRelease } from "./types";

/** Inhalt des Dialogs. Eigene Komponente, damit er beim Öffnen wieder bei Seite 1 beginnt. */
function Slides({ release, onClose }: { release: WhatsNewRelease; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const items = release.items;
  const last = items.length - 1;
  // releaseFor liefert nur Releases mit mindestens einem Eintrag.
  const item = items[Math.min(index, last)]!;

  const go = (next: number) => setIndex(Math.min(last, Math.max(0, next)));

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") go(index + 1);
    if (event.key === "ArrowLeft") go(index - 1);
  };

  return (
    <RadixDialog.Content
      onKeyDown={handleKeyDown}
      className="bg-surface border-border animate-pop-in flex w-full max-w-md flex-col gap-4 rounded-3xl border p-4 shadow-[0_24px_60px_rgb(0_0_0/0.5)] outline-none"
    >
      <div className="flex items-center justify-between">
        <span className="bg-accent/10 text-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
          <Sparkles aria-hidden="true" className="size-3.5" />
          Neu in Version {release.version}
        </span>
        <span className="flex items-center gap-1">
          {items.length > 1 && (
            <span className="text-muted text-xs tabular-nums">
              <span className="sr-only">Neuerung </span>
              {index + 1} / {items.length}
            </span>
          )}
          <RadixDialog.Close
            aria-label="Schließen"
            className="text-muted hover:text-text hover:bg-inset -mr-2 flex size-10 items-center justify-center rounded-card"
          >
            <X aria-hidden="true" className="size-5" />
          </RadixDialog.Close>
        </span>
      </div>

      {/* Vorschau ist Deko, der Text darunter erklärt die Neuerung. */}
      <div
        aria-hidden="true"
        className="bg-inset border-border flex h-46 items-center justify-center overflow-hidden rounded-[18px] border p-4.5"
      >
        <div key={index} className="animate-slide-in flex w-full justify-center">
          {item.preview ?? <PreviewIcon icon={item.icon} tone={item.tone} size="lg" />}
        </div>
      </div>

      <div key={index} className="animate-slide-in flex min-h-23 flex-col gap-1.5">
        <RadixDialog.Title className="text-xl font-semibold tracking-tight">
          {item.title}
        </RadixDialog.Title>
        <RadixDialog.Description className="text-muted text-sm leading-relaxed">
          {item.text}
        </RadixDialog.Description>
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {items.map((entry, k) => (
            <button
              key={entry.title}
              type="button"
              onClick={() => go(k)}
              aria-label={`Neuerung ${k + 1}: ${entry.title}`}
              aria-current={k === index || undefined}
              className="flex h-6 items-center px-0.5"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-[width,background-color] duration-200",
                  k === index ? "bg-accent w-5.5" : "bg-border-strong/60 w-1.5",
                )}
              />
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="h-12 flex-1"
          onClick={() => (index === 0 ? onClose() : go(index - 1))}
        >
          {index === 0 ? "Später" : "Zurück"}
        </Button>
        <Button
          className="h-12 flex-[1.4] font-semibold"
          onClick={() => (index < last ? go(index + 1) : onClose())}
        >
          {index < last ? "Weiter" : "Los geht’s"}
        </Button>
      </div>
    </RadixDialog.Content>
  );
}

interface WhatsNewDialogProps {
  release: WhatsNewRelease;
  open: boolean;
  onClose: () => void;
}

/** Karussell mit einer Seite je Neuerung. */
export function WhatsNewDialog({ release, open, onClose }: WhatsNewDialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-overlay animate-fade-in fixed inset-0 z-40 grid place-items-center overflow-y-auto p-4 backdrop-blur-sm">
          <Slides release={release} onClose={onClose} />
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Zeigt nach einem Update einmalig die Neuerungen für die Rolle des Nutzers. Nach dem Schließen
 * (egal wie) öffnet er erst beim nächsten Release wieder von selbst; über das Kontomenü
 * lässt er sich jederzeit erneut aufrufen.
 */
export function WhatsNew({ releases = releaseNotes }: { releases?: WhatsNewRelease[] }) {
  const user = useSession((state) => state.user);
  const seen = useSeenRelease(user?.id);
  const manualOpen = useWhatsNewDialog((state) => state.open);
  const { pathname } = useLocation();

  const release = user ? releaseFor(user.role, releases) : null;
  if (!user || !release) return null;

  // Nicht mitten ins laufende Training platzen; der Dialog kommt dann auf der nächsten Seite.
  const inWorkout = pathname.startsWith("/workouts/");
  const open = manualOpen || (seen !== release.id && !inWorkout);

  const close = () => {
    markReleaseSeen(user.id, release.id);
    useWhatsNewDialog.setState({ open: false });
  };

  return <WhatsNewDialog release={release} open={open} onClose={close} />;
}

/** So lange nach dem Erscheinen zeigt die Übersicht den Chip „Neu in Version …“. */
const CHIP_DAYS = 30;

/** Kleiner Knopf zum erneuten Öffnen, solange das Release frisch ist. */
export function WhatsNewChip({ releases = releaseNotes }: { releases?: WhatsNewRelease[] }) {
  const role = useSession((state) => state.user?.role);
  const [now] = useState(Date.now);
  const release = role ? releaseFor(role, releases) : null;
  if (!release) return null;

  const ageDays = (now - new Date(release.date).getTime()) / 86_400_000;
  if (ageDays > CHIP_DAYS) return null;

  return (
    <button
      type="button"
      onClick={openWhatsNew}
      className="border-accent/40 bg-accent/8 text-accent hover:bg-accent/15 inline-flex h-9 items-center gap-2 rounded-full border pr-3 pl-2.5 text-sm font-medium"
    >
      <Sparkles aria-hidden="true" className="size-4" />
      Neu in Version {release.version}
    </button>
  );
}
