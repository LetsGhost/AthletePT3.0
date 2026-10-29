import { addDays, todayIsoDate, type Notification, type NotificationKind } from "@athletept/shared";
import {
  Bell,
  BellRing,
  Flag,
  Medal,
  Swords,
  ThumbsDown,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { kindTone } from "@/features/challenges/tones";
import { useMarkAllRead, useMarkRead, useNotifications } from "@/features/notifications/api";
import { cn } from "@/lib/cn";

const kindIcon: Record<NotificationKind, LucideIcon> = {
  duel_invite: Swords,
  duel_accepted: Swords,
  duel_declined: ThumbsDown,
  duel_expired: BellRing,
  duel_gave_up: Flag,
  challenge_started: Trophy,
  challenge_overtaken: TrendingUp,
  challenge_finished: Medal,
};

const linkLabel: Partial<Record<NotificationKind, string>> = {
  duel_invite: "Einladung ansehen",
  duel_accepted: "Zum Duell",
  duel_gave_up: "Ergebnis",
  challenge_started: "Details",
  challenge_overtaken: "Rangliste ansehen",
  challenge_finished: "Ergebnis",
};

const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const weekdayFormat = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });

/** Kalendertag eines Zeitpunkts in der App-Zeitzone. */
const dayOf = (iso: string) => todayIsoDate(new Date(iso));

function groupOf(day: string, today: string) {
  if (day === today) return "Heute";
  if (day === addDays(today, -1)) return "Gestern";
  if (day > addDays(today, -7)) return "Diese Woche";
  return "Älter";
}

function timeOf(notification: Notification, today: string) {
  const at = new Date(notification.createdAt);
  const day = dayOf(notification.createdAt);
  if (day === today || day === addDays(today, -1)) return timeFormat.format(at);
  if (day > addDays(today, -7)) return weekdayFormat.format(at);
  return dateFormat.format(at);
}

function NotificationItem({ notification, today }: { notification: Notification; today: string }) {
  const markRead = useMarkRead();
  const Icon = kindIcon[notification.kind] ?? Bell;
  const tone = notification.challengeKind ? kindTone[notification.challengeKind] : null;
  const label = linkLabel[notification.kind];
  const read = () => {
    if (!notification.read) markRead.mutate(notification.id);
  };
  return (
    <li className={cn("flex gap-3 p-3.5", !notification.read && "bg-primary/10")}>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          tone?.tint ?? "bg-accent/15",
        )}
      >
        <Icon className={cn("size-5", tone?.text ?? "text-accent")} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm leading-snug", !notification.read && "font-semibold")}>
          {notification.title}
        </span>
        <span className="text-muted text-xs leading-snug">{notification.text}</span>
        {notification.challengeId && label && (
          <Link
            to={`/challenges/${notification.challengeId}`}
            onClick={read}
            className="text-accent mt-1 self-start text-sm font-medium"
          >
            {label}
          </Link>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-muted text-[11px]">{timeOf(notification, today)}</span>
        {!notification.read && (
          <span className="bg-accent size-2 rounded-full">
            <span className="sr-only">ungelesen</span>
          </span>
        )}
      </span>
    </li>
  );
}

export default function NotificationsPage() {
  const notifications = useNotifications();
  const markAll = useMarkAllRead();
  const today = todayIsoDate();

  return (
    <div className="mx-auto max-w-xl">
      <QueryState query={notifications} loading={<SkeletonList rows={5} className="h-18" />}>
        {({ items, unreadCount }) => {
          const groups = new Map<string, Notification[]>();
          for (const item of items) {
            const group = groupOf(dayOf(item.createdAt), today);
            groups.set(group, [...(groups.get(group) ?? []), item]);
          }
          return (
            <>
              <PageHeader
                title="Benachrichtigungen"
                description={unreadCount > 0 ? `${unreadCount} neu` : "Alles gelesen"}
                actions={
                  unreadCount > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={markAll.isPending}
                      onClick={() => markAll.mutate()}
                    >
                      Alle gelesen
                    </Button>
                  )
                }
              />
              {items.length === 0 ? (
                <div className="bg-surface rounded-tile">
                  <EmptyState
                    icon={Bell}
                    title="Alles erledigt"
                    description="Einladungen, Ergebnisse und neue Challenges landen hier."
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {[...groups].map(([group, list]) => (
                    <section key={group} aria-label={group} className="flex flex-col gap-1.5">
                      <h2 className="text-muted px-0.5 text-xs font-semibold tracking-wider uppercase">
                        {group}
                      </h2>
                      <ul className="bg-surface divide-border divide-y overflow-hidden rounded-tile">
                        {list.map((notification) => (
                          <NotificationItem
                            key={notification.id}
                            notification={notification}
                            today={today}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
