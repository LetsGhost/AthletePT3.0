import { addDays, daysInPeriod, DUEL_INVITE_DAYS, type ChallengeDetail } from "@athletept/shared";
import { Flag, Info, Medal, RotateCcw, Swords } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast-store";
import { cn } from "@/lib/cn";
import { initials, parseIsoDate } from "@/lib/format";
import { errorMessage } from "@/lib/http";

import { useAcceptDuel, useDeclineDuel, useGiveUpDuel, useRematchDuel } from "./api";
import { KindBadge, MetricChip } from "./challenge-visuals";
import { formatCountdown, formatPeriod, formatScore, pairScores } from "./format";

const dayNumber = new Intl.DateTimeFormat("de-DE", { day: "numeric" });

function durationName(days: number) {
  return days === 7 ? "1 Woche" : `${days / 7} Wochen`;
}

/** Beide Seiten des Duells aus Sicht des Betrachters. */
function duelSides(challenge: ChallengeDetail) {
  const me = challenge.standings.find((s) => s.isMe) ?? null;
  const opponent = challenge.standings.find((s) => !s.isMe) ?? null;
  return { me, opponent };
}

function Avatar({ name, mine, leading }: { name: string; mine: boolean; leading: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-14 items-center justify-center rounded-full text-lg font-semibold",
        mine ? "bg-primary text-on-primary" : "bg-challenge-duel/30",
        leading &&
          (mine
            ? "ring-accent ring-offset-surface ring-2 ring-offset-2"
            : "ring-challenge-duel ring-offset-surface ring-2 ring-offset-2"),
      )}
    >
      {initials(name)}
    </span>
  );
}

function leadText(challenge: ChallengeDetail) {
  const { me, opponent } = duelSides(challenge);
  const info = challenge.duel!;
  if (!me || !opponent) return "";
  const opponentName = info.opponentName ?? opponent.name;
  if (info.gaveUpName) {
    return me.achieved
      ? `${opponentName} hat aufgegeben, du gewinnst.`
      : `Du hast aufgegeben, ${opponentName} gewinnt.`;
  }
  const diff = formatScore(challenge.metric, Math.abs(me.score - opponent.score));
  if (challenge.status === "finished") {
    if (me.achieved) return `Du hast gewonnen, mit ${diff} Vorsprung.`;
    if (opponent.achieved) return `${opponentName} hat gewonnen, mit ${diff} Vorsprung.`;
    return "Unentschieden.";
  }
  if (me.score === opponent.score) return me.score === 0 ? "Noch ist alles offen" : "Gleichstand";
  return me.rank === 1 ? `Du führst mit ${diff}` : `${opponentName} führt mit ${diff}`;
}

/** Kopf-an-Kopf-Ansicht eines angenommenen Duells. */
export function DuelHero({ challenge }: { challenge: ChallengeDetail }) {
  const { me, opponent } = duelSides(challenge);
  const info = challenge.duel!;
  const total = (me?.score ?? 0) + (opponent?.score ?? 0);
  const share = total > 0 ? ((me?.score ?? 0) / total) * 100 : 50;
  const opponentName = info.opponentName ?? opponent?.name ?? "Gegner";
  const scores = pairScores(challenge.metric, me?.score ?? 0, opponent?.score ?? 0);
  const meLeads = me?.rank === 1 && (me?.score ?? 0) > 0;
  const opponentLeads = opponent?.rank === 1 && (opponent?.score ?? 0) > 0;

  return (
    <section className="border-challenge-duel/35 bg-surface flex flex-col gap-4 rounded-tile border p-4">
      <span className="flex flex-wrap items-center gap-1.5">
        <KindBadge kind="duel" />
        <MetricChip metric={challenge.metric} />
        <span className="flex-1" />
        <span
          className={cn("text-xs font-semibold", challenge.status === "finished" && "text-muted")}
        >
          {challenge.status === "finished" ? "Beendet" : formatCountdown(challenge)}
        </span>
      </span>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold">
          {challenge.title}
          {challenge.exerciseName && ` · ${challenge.exerciseName}`}
        </h1>
        <p className="text-muted text-sm">
          {durationName(info.durationDays)} · {formatPeriod(challenge.startDate, challenge.endDate)}
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <span className="flex flex-col items-center gap-1.5">
          <Avatar name={me?.name ?? "Du"} mine leading={meLeads} />
          <span className="text-sm font-semibold">Du</span>
        </span>
        <span className="flex flex-col items-center gap-1">
          <span
            className="flex items-baseline gap-2.5 text-[34px] leading-none font-bold tabular-nums"
            aria-label={`${scores.a} zu ${scores.b} ${scores.unit}`}
          >
            <span className={meLeads ? "text-accent" : undefined}>{scores.a}</span>
            <span className="text-muted text-xl">:</span>
            <span className={opponentLeads ? "text-challenge-duel" : undefined}>{scores.b}</span>
          </span>
          <span className="text-muted text-[11px]" aria-hidden="true">
            {scores.unit}
          </span>
        </span>
        <span className="flex min-w-0 flex-col items-center gap-1.5">
          <Avatar name={opponentName} mine={false} leading={opponentLeads} />
          <span className="max-w-full truncate text-sm font-semibold">{opponentName}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <span aria-hidden="true" className="flex h-2.5 gap-0.75 overflow-hidden rounded-full">
          <span className="bg-accent rounded-full" style={{ width: `${share}%` }} />
          <span className="bg-challenge-duel flex-1 rounded-full" />
        </span>
        <p className="text-center text-sm font-medium" aria-live="polite">
          {leadText(challenge)}
        </p>
      </div>
    </section>
  );
}

/** Verlauf pro Tag: gefüllt = Wert an diesem Tag. Lange Duelle in Blöcken zu 14 Tagen. */
export function DuelDaily({ challenge }: { challenge: ChallengeDetail }) {
  const { me, opponent } = duelSides(challenge);
  if (!me || !opponent) return null;
  const length = daysInPeriod(challenge.startDate, challenge.endDate);
  const days = Array.from({ length }, (_, i) => addDays(challenge.startDate, i));
  const values = new Map(challenge.daily.map((d) => [`${d.athleteId}|${d.date}`, d.value]));
  const opponentName = challenge.duel?.opponentName ?? opponent.name;
  const blocks = Array.from({ length: Math.ceil(days.length / 14) }, (_, i) =>
    days.slice(i * 14, i * 14 + 14),
  );

  const cell = (athleteId: string, date: string, mine: boolean) => {
    const value = values.get(`${athleteId}|${date}`) ?? 0;
    const future = date > challenge.today;
    return (
      <span
        key={`${athleteId}-${date}`}
        className={cn(
          "h-4.5 rounded",
          future
            ? "bg-bg"
            : value > 0
              ? mine
                ? "bg-accent"
                : "bg-challenge-duel"
              : "bg-inset border-border border",
        )}
      />
    );
  };

  return (
    <section aria-labelledby="duel-daily" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-0.5">
        <h2 id="duel-daily" className="font-semibold">
          Verlauf pro Tag
        </h2>
        <span className="text-muted flex gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-accent size-2.5 rounded-sm" /> Du
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-challenge-duel size-2.5 rounded-sm" /> {opponentName}
          </span>
        </span>
      </div>
      <div className="bg-surface flex flex-col gap-3 rounded-tile p-3.5">
        {blocks.map((block) => (
          <div
            key={block[0]}
            aria-hidden="true"
            className="grid items-center gap-0.75"
            style={{ gridTemplateColumns: `28px repeat(${block.length}, minmax(0, 1fr))` }}
          >
            <span />
            {block.map((date) => (
              <span
                key={date}
                className={cn(
                  "text-center text-[9px]",
                  date === challenge.today ? "text-accent font-semibold" : "text-muted",
                )}
              >
                {dayNumber.format(parseIsoDate(date))}
              </span>
            ))}
            <span className="text-muted text-[10px]">Du</span>
            {block.map((date) => cell(me.athleteId, date, true))}
            <span className="text-muted truncate text-[10px]">{initials(opponentName)}</span>
            {block.map((date) => cell(opponent.athleteId, date, false))}
          </div>
        ))}
        <p className="text-muted text-[11px]">
          Gefüllt = an diesem Tag gezählt.{" "}
          <span className="sr-only">
            Du an {challenge.daily.filter((d) => d.athleteId === me.athleteId).length} Tagen,{" "}
            {opponentName} an{" "}
            {challenge.daily.filter((d) => d.athleteId === opponent.athleteId).length} Tagen.
          </span>
        </p>
      </div>
    </section>
  );
}

function timeLeft(expiresAt: string) {
  const hours = Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 3_600_000));
  if (hours < 1) return "unter 1 Std.";
  if (hours < 24) return `${hours} Std.`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return `${days} ${days === 1 ? "Tag" : "Tage"}${rest ? ` ${rest} Std.` : ""}`;
}

function Fact({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <span className="bg-inset flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left">
      <span className="text-muted text-[11px]">{label}</span>
      <span className={cn("text-sm font-semibold", warn && "text-warning")}>{value}</span>
    </span>
  );
}

/** Offene Einladung: Eingeladener nimmt an oder lehnt ab, der Herausforderer wartet. */
export function DuelInvitation({ challenge }: { challenge: ChallengeDetail }) {
  const navigate = useNavigate();
  const accept = useAcceptDuel(challenge.id);
  const decline = useDeclineDuel();
  const info = challenge.duel!;
  const incoming = info.iAmChallenger === false;
  const opponent = info.opponentName ?? info.invitedEmail ?? "Dein Gegner";
  const title = incoming
    ? `${opponent} fordert dich heraus`
    : info.opponentName
      ? `Revanche gegen ${info.opponentName}`
      : "Wartet auf Antwort";

  return (
    <div className="flex flex-col gap-4">
      <section className="border-challenge-duel/40 bg-surface flex flex-col items-center gap-3.5 rounded-[22px] border px-4.5 py-5.5 text-center">
        <KindBadge kind="duel" />
        <div className="flex items-center gap-3.5" aria-hidden="true">
          <span className="bg-challenge-duel/30 flex size-15 items-center justify-center rounded-full text-xl font-semibold">
            {info.opponentName ? initials(info.opponentName) : "?"}
          </span>
          <Swords className="text-challenge-duel size-6" />
          <span className="bg-primary text-on-primary flex size-15 items-center justify-center rounded-full text-xl font-semibold">
            {initials(challenge.standings.find((s) => s.isMe)?.name ?? "Du")}
          </span>
        </div>
        <h1 className="text-[21px] font-semibold">{title}</h1>
        {!incoming && info.invitedEmail && (
          <p className="text-muted -mt-2 text-sm">Einladung an {info.invitedEmail}</p>
        )}
        <div className="grid w-full grid-cols-2 gap-2">
          <Fact
            label="Wertung"
            value={`${challenge.title}${challenge.exerciseName ? ` · ${challenge.exerciseName}` : ""}`}
          />
          <Fact label="Laufzeit" value={durationName(info.durationDays)} />
          <Fact label="Start" value="Sofort bei Annahme" />
          <Fact label="Läuft ab in" value={timeLeft(info.expiresAt)} warn />
        </div>
      </section>
      <p className="text-muted flex gap-2 text-xs leading-relaxed">
        <Info aria-hidden="true" className="size-4 shrink-0" />
        Gewertet werden nur erledigte Trainings. Du kannst während des Duells jederzeit aufgeben.
      </p>
      {incoming && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            loading={decline.isPending}
            onClick={() =>
              decline.mutate(challenge.id, {
                onSuccess: () => {
                  toast(`Einladung abgelehnt. ${opponent} bekommt einen Hinweis.`);
                  void navigate("/challenges");
                },
                onError: (error) => toast(errorMessage(error), "error"),
              })
            }
          >
            Ablehnen
          </Button>
          <Button
            className="bg-challenge-duel text-bg hover:bg-challenge-duel flex-[1.4] hover:opacity-90"
            loading={accept.isPending}
            onClick={() =>
              accept.mutate(undefined, {
                onSuccess: () => toast("Duell läuft! Viel Erfolg."),
                onError: (error) => toast(errorMessage(error), "error"),
              })
            }
          >
            Annehmen
          </Button>
        </div>
      )}
    </div>
  );
}

/** Ergebnis eines beendeten Duells. */
export function DuelResult({ challenge }: { challenge: ChallengeDetail }) {
  const { me } = duelSides(challenge);
  if (challenge.status !== "finished" || !me) return null;
  const won = me.achieved === true;
  return (
    <section
      className={cn(
        "flex items-center gap-3.5 rounded-tile border p-4",
        won ? "border-challenge-duel/40 bg-challenge-duel/10" : "bg-surface border-transparent",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-2xl",
          won ? "bg-challenge-duel/20" : "bg-inset",
        )}
      >
        <Medal
          aria-hidden="true"
          className={cn("size-6", won ? "text-challenge-duel" : "text-muted")}
        />
      </span>
      <span className="flex flex-col">
        <span className="text-lg font-semibold">
          {won
            ? "Duell gewonnen!"
            : me.achieved === false
              ? "Knapp vorbei, stark gekämpft"
              : "Unentschieden"}
        </span>
        <span className="text-muted text-sm">
          {won
            ? "Am Ende hat deine Konstanz den Unterschied gemacht."
            : "Revanche? Oder wähl eine Metrik, die dir mehr liegt."}
        </span>
      </span>
    </section>
  );
}

/** Aufgeben (läuft) bzw. Revanche (beendet). */
export function DuelActions({ challenge }: { challenge: ChallengeDetail }) {
  const navigate = useNavigate();
  const giveUp = useGiveUpDuel(challenge.id);
  const rematch = useRematchDuel(challenge.id);
  const [confirm, setConfirm] = useState(false);
  const opponent = challenge.duel?.opponentName ?? "Dein Gegner";

  if (challenge.status === "running") {
    return (
      <>
        <Button variant="secondary" className="text-danger" onClick={() => setConfirm(true)}>
          <Flag aria-hidden="true" className="size-4" /> Aufgeben
        </Button>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Duell aufgeben?"
          description={`${opponent} gewinnt dann sofort. Das lässt sich nicht rückgängig machen.`}
          confirmLabel="Aufgeben"
          cancelLabel="Weiterkämpfen"
          destructive
          loading={giveUp.isPending}
          onConfirm={() =>
            giveUp.mutate(undefined, {
              onSuccess: () => setConfirm(false),
              onError: (error) => toast(errorMessage(error), "error"),
            })
          }
        />
      </>
    );
  }
  if (challenge.status === "finished" && challenge.standings.length === 2) {
    return (
      <Button
        size="lg"
        className="bg-challenge-duel text-bg hover:bg-challenge-duel hover:opacity-90"
        loading={rematch.isPending}
        onClick={() =>
          rematch.mutate(undefined, {
            onSuccess: (created) => {
              toast(`Revanche gefordert. ${opponent} hat ${DUEL_INVITE_DAYS} Tage Zeit.`);
              void navigate(`/challenges/${created.id}`);
            },
            onError: (error) => toast(errorMessage(error), "error"),
          })
        }
      >
        <RotateCcw aria-hidden="true" className="size-4" /> Revanche fordern
      </Button>
    );
  }
  return null;
}

/** Hinweis zur Wertung und zur Sichtbarkeit von Namen. */
export function DuelPrivacyNote() {
  return (
    <p className="bg-inset text-muted flex gap-2.5 rounded-tile px-3.5 py-3 text-xs leading-relaxed">
      <Info aria-hidden="true" className="size-4 shrink-0" />
      Gewertet werden nur erledigte Trainings im Zeitraum. Trainiert dein Gegner bei einem anderen
      Coach, siehst du nur Vorname und Initial.
    </p>
  );
}

export function StartDuelLink({ className }: { className?: string }) {
  return (
    <Link
      to="/challenges/duell"
      className={cn(
        "border-challenge-duel/45 text-challenge-duel inline-flex h-10 shrink-0 items-center gap-1.5 rounded-card border px-3 text-sm font-semibold",
        className,
      )}
    >
      <Swords aria-hidden="true" className="size-4" /> Duell starten
    </Link>
  );
}
