import { challengeMetricLabels, systemRhythmLabels, type SystemTemplate } from "@athletept/shared";
import { Globe, Info, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast-store";
import { ChallengeIcon } from "@/features/challenges/challenge-visuals";
import { formatPeriod, formatScore } from "@/features/challenges/format";
import { Switch } from "@/features/settings/settings-parts";
import {
  useDeleteSystemTemplate,
  useSystemTemplates,
  useUpdateSystemTemplate,
} from "@/features/system-challenges/api";
import { formatNumber, parseIsoDate } from "@/lib/format";
import { errorMessage } from "@/lib/http";

const shortDate = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function roundText(template: SystemTemplate) {
  const round = template.currentRound;
  if (template.status === "draft") return { main: "Entwurf", sub: "noch nicht veröffentlicht" };
  if (!round) return { main: template.status === "paused" ? "pausiert" : "–", sub: "keine Runde" };
  const period = formatPeriod(round.startDate, round.endDate);
  const next = template.nextRoundStart
    ? `nächste Runde ${shortDate.format(parseIsoDate(template.nextRoundStart))}`
    : round.status === "planned"
      ? "geplant, Beitreten schon möglich"
      : "läuft";
  return { main: period, sub: template.status === "paused" ? "pausiert, endet regulär" : next };
}

function TemplateRow({ template }: { template: SystemTemplate }) {
  const id = useId();
  const update = useUpdateSystemTemplate();
  const remove = useDeleteSystemTemplate();
  const [confirm, setConfirm] = useState(false);
  const round = roundText(template);
  const tiers = template.tiers.map((t) => formatScore(template.metric, t)).join(" / ");
  const setStatus = (status: "active" | "paused") =>
    update.mutate(
      { id: template.id, body: { status } },
      {
        onSuccess: () =>
          toast(status === "active" ? "Vorlage ist aktiv." : "Pausiert ab der nächsten Runde."),
        onError: (error) => toast(errorMessage(error), "error"),
      },
    );

  return (
    <li className="grid grid-cols-1 gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_auto] md:items-center md:gap-4">
      <span className="flex min-w-0 items-center gap-3">
        <ChallengeIcon kind="system" metric={template.metric} />
        <span className="flex min-w-0 flex-col">
          <span id={`${id}-name`} className="truncate font-semibold">
            {template.title}
          </span>
          <span className="text-muted truncate text-xs">
            {challengeMetricLabels[template.metric]} · {tiers}
          </span>
        </span>
      </span>
      <span className="text-sm">{systemRhythmLabels[template.rhythm]}</span>
      <span className="flex flex-col">
        <span className="text-sm">{round.main}</span>
        <span className="text-muted text-xs">{round.sub}</span>
      </span>
      <span className="text-sm tabular-nums">
        {template.currentRound ? formatNumber(template.currentRound.participantCount) : "–"}
        <span className="text-muted md:sr-only"> Teilnehmer</span>
      </span>
      <span className="flex items-center gap-2">
        {template.status === "draft" ? (
          <>
            <Button size="sm" loading={update.isPending} onClick={() => setStatus("active")}>
              Veröffentlichen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Entwurf ${template.title} löschen`}
              onClick={() => setConfirm(true)}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </>
        ) : (
          <Switch
            checked={template.status === "active"}
            labelledBy={`${id}-name`}
            onChange={(on) => setStatus(on ? "active" : "paused")}
          />
        )}
      </span>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Entwurf löschen?"
        confirmLabel="Löschen"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(template.id, {
            onSuccess: () => setConfirm(false),
            onError: (error) => toast(errorMessage(error), "error"),
          })
        }
      />
    </li>
  );
}

export default function SystemChallengesPage() {
  const templates = useSystemTemplates();
  const newButton = (
    <Button asChild>
      <Link to="/admin/system-challenges/new">
        <Plus aria-hidden="true" className="size-4" /> Neue Vorlage
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader
        title="System-Challenges"
        description="Globale Challenges für alle Athleten. Teilnahme ist freiwillig (Opt-in mit Spitzname)."
        actions={newButton}
      />
      <QueryState query={templates} loading={<SkeletonList rows={4} className="h-16" />}>
        {({ items, activeParticipants }) => {
          if (items.length === 0) {
            return (
              <div className="bg-surface rounded-tile">
                <EmptyState
                  icon={Globe}
                  title="Noch keine System-Challenge"
                  description="Lege eine Vorlage an, zum Beispiel eine monatliche Konstanz-Challenge mit Bronze, Silber und Gold."
                  action={newButton}
                />
              </div>
            );
          }
          const active = items.filter((t) => t.status === "active");
          const running = items.filter((t) => t.currentRound?.status === "running");
          return (
            <div className="flex flex-col gap-6">
              <ul aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {[
                  [
                    "Aktive Vorlagen",
                    String(active.length),
                    `${items.length - active.length} pausiert oder Entwurf`,
                  ],
                  ["Laufende Runden", String(running.length), "jetzt gerade"],
                  ["Teilnehmer", formatNumber(activeParticipants), "in laufenden Runden"],
                ].map(([label, value, note]) => (
                  <li key={label} className="bg-surface flex flex-col gap-1 rounded-tile p-4">
                    <span className="text-muted text-sm">{label}</span>
                    <span className="text-2xl font-semibold tabular-nums">{value}</span>
                    <span className="text-muted text-xs">{note}</span>
                  </li>
                ))}
              </ul>
              <section aria-labelledby="templates" className="flex flex-col gap-3">
                <h2 id="templates" className="text-lg font-semibold">
                  Vorlagen &amp; Events
                </h2>
                <div className="bg-surface overflow-hidden rounded-tile">
                  <div className="border-border text-muted hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_auto] gap-4 border-b px-4 py-3 text-xs md:grid">
                    <span>Vorlage</span>
                    <span>Rhythmus</span>
                    <span>Aktuelle Runde</span>
                    <span>Teilnehmer</span>
                    <span>Aktiv</span>
                  </div>
                  <ul className="divide-border divide-y">
                    {items.map((template) => (
                      <TemplateRow key={template.id} template={template} />
                    ))}
                  </ul>
                </div>
              </section>
              <p className="text-muted flex gap-2 text-xs leading-relaxed">
                <Info aria-hidden="true" className="size-4 shrink-0" />
                Wiederkehrende Vorlagen starten automatisch eine neue Runde. Pausieren wirkt ab der
                nächsten Runde, laufende Runden enden regulär.
              </p>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
